import PurchaseRequisitionForm from "@/components/pr/PurchaseRequisitionForm";

export default function LiffCreatePurchaseRequisitionPage() {
    return (
        <div className="min-h-screen bg-slate-100 p-4 pb-24">
            <PurchaseRequisitionForm
                mode="create"
                backHref="/liff"
                projectFallbackHref="/liff"
                redirectAfterSaveBasePath="/liff/pr"
            />
        </div>
    );
}
