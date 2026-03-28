# PR and Price Comparison System Design

## 1. Current System Analysis

### 1.1 Current stack and architecture

The existing system is a `Next.js 16 + React 19 + Firebase` application.

Core characteristics found in the codebase:

- Firestore is the main transactional database
- Firebase Auth is used for login and role loading
- Firebase Admin is used on API routes
- LINE LIFF and LINE Messaging API are used for approval notification and action links
- Project selection is a global context, and most operational documents are tied to `projectId`

Main evidence in the current code:

- `src/context/AuthContext.tsx`
- `src/context/ProjectContext.tsx`
- `src/lib/firebase.ts`
- `src/lib/firebaseAdmin.ts`
- `src/app/api/line/notify/route.ts`

### 1.2 Existing business modules

The system already has 3 operational document modules:

- `PO` for purchase orders
- `WC` for work contracts / labor contracts
- `VO` for variation orders

Current collections in use:

- `purchase_orders`
- `work_contracts`
- `variation_orders`
- `vendors`
- `contractors`
- `projects`
- `users`
- `system_settings`

Document numbering is centralized and reusable:

- `PO`
- `WC`
- `VO`

This is handled in `src/lib/documentNumbers.ts`.

### 1.3 Current document flow

#### PO

Current PO flow:

1. User selects project
2. User creates PO directly
3. User picks vendor and enters items
4. User saves as `draft` or sends as `pending`
5. LINE notification is sent on `pending`
6. `admin` or `pm` approves/rejects
7. Dashboard counts only approved PO into committed budget

Observed in:

- `src/app/(dashboard)/po/create/page.tsx`
- `src/app/(dashboard)/po/[id]/page.tsx`
- `src/app/liff/approve/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

#### WC

Current WC flow is similar to PO, but uses `contractors` and allows:

- work title
- work period
- payment terms
- notes
- additional fees

Observed in:

- `src/app/(dashboard)/wc/create/page.tsx`
- `src/types/wc.ts`

#### VO

VO adjusts budget impact and is counted separately from PO/WC.

Observed in:

- `src/app/(dashboard)/vo/create/page.tsx`
- `src/app/(dashboard)/dashboard/page.tsx`

### 1.4 Roles and approval model

Current roles:

- `admin`
- `procurement`
- `pm`
- `engineer`

Current approval behavior:

- approval is effectively single-step
- approvers are only `admin` and `pm`
- status is stored as a single field: `draft | pending | approved | rejected`
- no approval history array
- no comment log
- no approval matrix by amount / type / project

Observed in:

- `src/types/auth.ts`
- `src/app/liff/approve/page.tsx`
- `src/app/(dashboard)/po/[id]/page.tsx`
- `src/app/(dashboard)/vo/[id]/page.tsx`
- `src/app/(dashboard)/wc/[id]/page.tsx`

### 1.5 Budget logic today

Current dashboard logic:

- initial budget comes from `project.budget`
- approved `VO` changes available budget
- approved `PO + WC` are counted as committed cost
- draft and pending documents do not reserve or consume budget

This is good and should remain true after adding PR.

Observed in:

- `src/app/(dashboard)/dashboard/page.tsx`

### 1.6 Strengths of the existing system

- There is already a working operational document layer
- Document numbering is reusable
- Vendor and contractor masters already exist
- LINE approval already works for remote approval
- Project-based budget dashboard already exists
- `system_settings` already stores reusable config and templates

### 1.7 Current gaps for procurement control

This is the main business gap:

The system creates `PO/WC` directly, but there is no formal pre-purchase request layer.

As a result:

1. No `PR` request stage before procurement action
2. No traceable price comparison between suppliers
3. No audit trail for who requested, who sourced, and why a supplier was selected
4. No separation between "need approval" and "commercial approval"
5. No conversion trail from request -> comparison -> PO/WC
6. No reservation visibility for pending procurement demand
7. No structured supplier recommendation record

This means the system is already strong as an execution system, but still missing the procurement-control layer.

## 2. Recommended Target Design

### 2.1 Design principle

Do not replace the current `PO/WC/VO` modules.

Add a new upstream layer:

`PR -> Price Comparison -> Approved Supplier Selection -> PO/WC`

This keeps the current execution documents as the final contract/order records and adds governance before those records are issued.

### 2.2 Scope of the new modules

Recommended new modules:

1. `PR` module
2. `Price Comparison` module
3. `Conversion` flow from approved PR to `PO` or `WC`
4. `Approval history` model for PR/comparison decisions

Not recommended for phase 1:

- replacing vendor and contractor master with one unified master
- changing budget calculation to count PR as committed cost
- building full multi-round e-bidding

## 3. Proposed Business Flow

### 3.1 New end-to-end process

Recommended process:

1. Engineer or PM creates `PR`
2. PM approves need/request
3. Procurement receives approved PR
4. Procurement records supplier quotations
5. System compares quotes
6. Procurement selects recommended supplier with reason
7. PM or Admin approves commercial selection
8. System converts approved result into `PO` or `WC`
9. Existing PO/WC approval and budget logic continue as today

### 3.2 Document stages

Recommended lifecycle:

#### PR

- `draft`
- `pending_need_approval`
- `approved_for_sourcing`
- `rejected`
- `sourcing`
- `comparing`
- `selection_pending`
- `selected`
- `converted_partial`
- `converted_full`
- `cancelled`

#### Price Comparison

- `draft`
- `in_review`
- `approved`
- `rejected`

#### PO/WC

Keep the existing statuses for now:

- `draft`
- `pending`
- `approved`
- `rejected`

## 4. Proposed Data Model

### 4.1 New collection: `purchase_requisitions`

Purpose:

- store the internal request before procurement commits to a supplier

Suggested fields:

```ts
type RequisitionItem = {
  id: string;
  description: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice?: number;
  estimatedAmount?: number;
  category?: string;
  notes?: string;
};

type ApprovalAction = {
  stepKey: string;
  stepLabel: string;
  approverUid?: string;
  approverName?: string;
  role?: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  actionAt?: unknown;
  comment?: string;
};

type PurchaseRequisition = {
  id: string;
  prNumber: string;
  projectId: string;
  requestType: "material" | "service";
  fulfillmentType: "po" | "wc";
  title: string;
  department?: string;
  requestedBy: string;
  requestedAt?: unknown;
  requiredDate?: string;
  reason: string;
  urgency: "low" | "normal" | "high" | "urgent";
  items: RequisitionItem[];
  estimatedSubTotal: number;
  estimatedVatAmount: number;
  estimatedTotalAmount: number;
  preferredVendorIds?: string[];
  preferredContractorIds?: string[];
  status:
    | "draft"
    | "pending_need_approval"
    | "approved_for_sourcing"
    | "rejected"
    | "sourcing"
    | "comparing"
    | "selection_pending"
    | "selected"
    | "converted_partial"
    | "converted_full"
    | "cancelled";
  currentComparisonId?: string;
  selectedComparisonId?: string;
  selectedSupplierType?: "vendor" | "contractor";
  selectedSupplierId?: string;
  linkedPoIds?: string[];
  linkedWcIds?: string[];
  approvalTrail?: ApprovalAction[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
```

### 4.2 New collection: `pr_price_comparisons`

Purpose:

- store one sourcing/comparison round per PR

Suggested fields:

```ts
type ComparisonSupplierQuoteItem = {
  requisitionItemId: string;
  unitPrice: number;
  amount: number;
  remark?: string;
  leadTimeDays?: number;
  brand?: string;
  isCompliant?: boolean;
};

type ComparisonSupplierQuote = {
  supplierType: "vendor" | "contractor";
  supplierId: string;
  supplierName: string;
  quotedAt?: string;
  quoteRef?: string;
  vatMode?: "none" | "exclusive" | "inclusive";
  creditDays?: number;
  deliveryDays?: number;
  items: ComparisonSupplierQuoteItem[];
  subTotal: number;
  vatAmount: number;
  totalAmount: number;
  attachments?: string[];
  note?: string;
  complianceScore?: number;
  commercialScore?: number;
  overallRank?: number;
};

type PriceComparison = {
  id: string;
  comparisonNumber: string;
  prId: string;
  projectId: string;
  sourcingBy: string;
  sourcingStartedAt?: unknown;
  quotes: ComparisonSupplierQuote[];
  recommendationType: "lowest_price" | "best_value" | "technical_fit";
  recommendedSupplierType?: "vendor" | "contractor";
  recommendedSupplierId?: string;
  recommendedSupplierName?: string;
  recommendationReason?: string;
  status: "draft" | "in_review" | "approved" | "rejected";
  approvalTrail?: ApprovalAction[];
  createdAt?: unknown;
  updatedAt?: unknown;
};
```

### 4.3 Minimal extension to existing `PO` and `WC`

Do not redesign PO/WC heavily.

Add traceability fields:

```ts
sourcePrId?: string;
sourceComparisonId?: string;
sourceSelectionType?: "vendor" | "contractor";
```

This gives full backward traceability without breaking the current UI.

### 4.4 Optional future collection: `procurement_activity_logs`

Not required in phase 1, but useful later for:

- action timeline
- sourcing turnaround time
- audit reporting

## 5. How the New Design Fits the Existing System

### 5.1 Reuse existing document number utility

Extend `DocumentSeries` in `src/lib/documentNumbers.ts` to support:

- `PR`
- optionally `PC` or `CMP` for price comparison

Suggested prefixes:

- `PR{PROJECT}-{YYYYMM}-P001`
- `PC{PROJECT}-{YYYYMM}-P001`

### 5.2 Reuse current approval UI and LINE integration

The current `liff/approve` and `api/line/notify` model already supports remote approve/reject.

Recommended change:

- add support for `PR`
- add support for `PC`
- keep same LIFF concept

This is a low-risk extension because the current approval transport already works.

### 5.3 Keep dashboard commitment logic unchanged

Recommended rule:

- `PR` should be visible as demand
- `PR` should not count as committed budget
- only approved `PO/WC` should count as committed budget

Optional dashboard additions:

- pending PR amount
- sourcing backlog
- number of PR waiting for quote comparison
- conversion rate from PR to PO/WC

### 5.4 Reuse current masters instead of rebuilding supplier master

Current master split:

- `vendors` for purchase suppliers
- `contractors` for service/work suppliers

Recommended phase 1 approach:

- keep both masters as-is
- use `supplierType` to identify which master is referenced

This avoids high migration cost.

## 6. Recommended Functional Screens

### 6.1 PR module

Recommended pages:

- `PR List`
- `Create PR`
- `PR Detail`
- `Edit PR`
- `PR Sourcing Board`

Main PR list columns:

- PR number
- project
- title
- type
- requester
- required date
- estimated total
- status
- current step

### 6.2 Price comparison module

Recommended pages:

- `Create Comparison from PR`
- `Comparison Detail`
- `Comparison Approval`

Main comparison view should show:

- supplier rows
- item-level quote details
- total price
- VAT mode
- lead time
- credit term
- compliance flag
- recommended supplier
- reason for non-lowest-price selection

### 6.3 Conversion actions

On approved PR/comparison:

- `Convert to PO`
- `Convert to WC`

Conversion rules:

- material request defaults to `PO`
- service request defaults to `WC`
- allow partial conversion if the PR contains mixed fulfillment or phased procurement

## 7. Approval Design Recommendation

### 7.1 Recommended approval matrix

Phase 1 recommended matrix:

#### PR need approval

- requester: `engineer` or `pm`
- approver: `pm` or `admin`

#### Price comparison approval

- preparer: `procurement`
- approver: `pm` or `admin`

#### PO/WC final issuance

- keep current approval flow for now

### 7.2 Why not keep a single status field only

For PR and comparison, a single `status` field is not enough.

You need at least:

- current status
- who approved
- when
- which step
- reason/comment

So the recommended pattern is:

- keep `status` for fast filtering
- add `approvalTrail[]` for history

This is the lowest-friction way to evolve the existing design.

## 8. Price Comparison Logic Recommendation

### 8.1 Comparison method

For each supplier quote, compare:

- total quoted amount
- item-level compliance
- VAT mode
- credit term
- delivery lead time
- note / exclusions

### 8.2 Recommendation rule

Do not force "lowest price wins".

Recommended business rule:

- if lowest price is compliant, recommend lowest price
- if lowest price is not selected, user must enter mandatory reason

Suggested reasons:

- out of spec
- lead time too long
- poor credit term
- incomplete scope
- supplier reliability issue
- preferred vendor due to warranty/service

### 8.3 Comparison output

System should produce:

- ranked supplier list
- winning supplier
- commercial summary
- reason for selection

This becomes the formal procurement justification record.

## 9. Minimal-Change Implementation Plan

### Phase 1: Add PR foundation

Build:

- `purchase_requisitions` collection
- PR type definitions
- PR listing/create/detail/edit pages
- PR numbering
- PR LINE approval

Do not build conversion yet in the same first step if speed matters.

### Phase 2: Add price comparison

Build:

- `pr_price_comparisons` collection
- comparison UI
- supplier quote entry
- recommendation logic
- comparison approval

### Phase 3: Add conversion to PO/WC

Build:

- create PO from approved comparison
- create WC from approved comparison
- store `sourcePrId` and `sourceComparisonId`
- mark PR as `converted_partial` or `converted_full`

### Phase 4: Reporting and controls

Build:

- PR pipeline dashboard
- sourcing aging
- supplier win/loss report
- price history by item/vendor

## 10. Firestore and Index Recommendations

Recommended new indexes:

### `purchase_requisitions`

- `projectId + createdAt desc`
- `status + createdAt desc`
- `requestedBy + createdAt desc`

### `pr_price_comparisons`

- `prId + createdAt desc`
- `projectId + createdAt desc`
- `status + createdAt desc`

This follows the same pattern already required by the current system for document listing.

## 11. Risks to Avoid

1. Do not merge PR directly into PO.
   If you do that, you lose the separation between internal demand and external commitment.

2. Do not count PR as committed budget.
   It will distort the dashboard and double count once PO/WC is issued.

3. Do not redesign vendor/contractor master in the same phase.
   That is a separate refactor and not necessary for business value now.

4. Do not keep approval as only one flat status if you add PR.
   Procurement review needs traceability.

5. Do not skip conversion links.
   You need full traceability from PR to final order/contract.

## 12. Recommended Final Structure

### Existing modules to keep

- PO
- WC
- VO
- Vendors
- Contractors
- Projects
- Users
- LINE approval

### New modules to add

- PR
- Price Comparison
- Conversion to PO/WC
- Approval trail

### Final target flow

`Engineer/PM request -> PM approve need -> Procurement collect quotes -> Comparison approval -> Convert to PO/WC -> Existing approval and budget flow`

## 13. Best Practical Recommendation for This Codebase

For this specific codebase, the best path is:

1. Add `PR` as a separate upstream document
2. Add `Price Comparison` as a child process of PR
3. Keep `PO/WC` as the final operational document
4. Reuse current numbering, LINE approval, settings, and project-based budget logic
5. Add traceability fields instead of rebuilding the whole system

This gives you the procurement governance you want without breaking the parts that already work.

## 14. Suggested Build Order

If you want the safest rollout, build in this order:

1. PR data model and screens
2. PR approval via LINE
3. price comparison data model and screen
4. comparison approval
5. convert approved result to PO/WC
6. dashboard/report enhancements

## 15. Immediate Development Tasks

Recommended next implementation backlog:

1. Add `PR` and `Price Comparison` types under `src/types`
2. Extend `src/lib/documentNumbers.ts` for `PR`
3. Create `src/app/(dashboard)/pr/*`
4. Extend `src/app/api/line/notify/route.ts` for `PR`
5. Extend `src/app/liff/approve/page.tsx` and `src/app/liff/view/page.tsx` for `PR`
6. Add `sourcePrId` and `sourceComparisonId` to `PO/WC`
7. Add PR menu and dashboard summary cards

## 16. Conclusion

The current system is already a solid execution layer for `PO/WC/VO`.

What is missing is not a replacement system. What is missing is the procurement-control layer before PO/WC issuance.

So the correct design direction is:

- keep the existing document system
- add `PR`
- add `Price Comparison`
- add approval trail
- convert approved selections into the current `PO/WC`

That is the cleanest, lowest-risk, and most scalable extension for this codebase.
