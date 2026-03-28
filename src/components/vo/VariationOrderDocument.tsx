import { VariationOrder } from "@/types/vo";

export type SignatureOption = {
    id?: string;
    name?: string;
    position?: string;
    signatureUrl?: string;
};

export type CompanySettings = {
    name: string;
    address: string;
    phone: string;
    email: string;
    logoUrl?: string;
    signatureUrl?: string;
    signatures?: SignatureOption[];
};

function toSignedCurrency(value: number) {
    const sign = value > 0 ? "+" : "";
    return `${sign}${value.toLocaleString(undefined, { minimumFractionDigits: 2 })}`;
}

type VariationOrderDocumentProps = {
    vo: VariationOrder;
    companySettings: CompanySettings;
    projectName?: string;
    projectContactName: string;
    createdAtLabel: string;
    primarySignature: SignatureOption | null;
    layoutVariant?: "screen" | "attachment";
};

export function VariationOrderDocument({
    vo,
    companySettings,
    projectName,
    projectContactName,
    createdAtLabel,
    primarySignature,
    layoutVariant = "screen",
}: VariationOrderDocumentProps) {
    const minDisplayRows = 10;
    const emptyRowCount = Math.max(0, minDisplayRows - vo.items.length);
    const isAttachmentLayout = layoutVariant === "attachment";
    const outerWidthClass = isAttachmentLayout ? "w-[210mm] max-w-[210mm]" : "w-full max-w-[210mm]";
    const paperHeightClass = isAttachmentLayout ? "h-[297mm] min-h-[297mm]" : "min-h-[297mm]";
    const paperPaddingClass = isAttachmentLayout ? "p-[8mm]" : "p-[5mm]";
    const innerMinHeightClass = isAttachmentLayout ? "min-h-[281mm]" : "min-h-[287mm]";
    const innerPaddingClass = isAttachmentLayout ? "px-[4mm] pt-[3.5mm] pb-[9mm]" : "px-[5mm] pt-[4mm] pb-[10mm]";
    const printPaperPaddingClass = isAttachmentLayout ? "print:p-[8mm]" : "print:p-0";

    return (
        <div className={`mx-auto overflow-hidden bg-white shadow-[0_22px_70px_rgba(15,23,42,0.12)] print:max-w-none print:shadow-none ${outerWidthClass}`}>
            <div className={`${outerWidthClass} ${paperHeightClass} bg-white ${paperPaddingClass} print:min-h-0 print:h-[297mm] ${printPaperPaddingClass} print:text-black`}>
                <div className={`${innerMinHeightClass} border border-black ${innerPaddingClass} relative`}>
                    <div className="flex justify-between items-start mb-6">
                        <div className="w-[120px] h-[80px] flex items-center justify-center shrink-0 overflow-hidden text-center">
                            {companySettings.logoUrl ? (
                                <img src={companySettings.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                            ) : (
                                <span className="text-orange-600 text-xs font-bold shrink-0">LOGO</span>
                            )}
                        </div>
                        <div className="flex-1 text-center px-4">
                            <h2 className="text-[20px] font-bold mb-1 leading-tight">{companySettings.name}</h2>
                            <p className="text-[11px] leading-relaxed font-semibold">{companySettings.address}</p>
                            <p className="text-[11px] leading-relaxed font-semibold">
                                โทรศัพท์: <span className="font-bold">{companySettings.phone}</span>
                            </p>
                            <p className="text-[11px] leading-relaxed font-semibold">
                                Email: <span className="font-bold">{companySettings.email}</span>
                            </p>
                        </div>
                        <div className="w-[180px] shrink-0 flex items-start justify-end">
                            <span className="text-[13px] font-bold border-2 border-black px-3 py-1.5 inline-block text-center leading-tight">
                                VARIATION ORDER
                                <br />
                                <span className="text-[10px] font-semibold">ใบสั่งเปลี่ยนแปลงงาน</span>
                            </span>
                        </div>
                    </div>

                    <div className="grid grid-cols-12 gap-x-2 gap-y-2 mb-4 text-[12px] font-medium items-center border-b border-black pb-4">
                        <div className="col-span-1">เรียน</div>
                        <div className="col-span-7 border-b-2 border-black h-5 mr-3 leading-none">{projectContactName}</div>
                        <div className="col-span-1 text-right">วันที่</div>
                        <div className="col-span-3 border-b-2 border-black h-5 px-1 leading-none text-right">{createdAtLabel}</div>

                        <div className="col-span-1">เรื่อง</div>
                        <div className="col-span-7 border-b-2 border-black h-5 mr-3 leading-none">{vo.title}</div>
                        <div className="col-span-1 text-right">เลขที่</div>
                        <div className="col-span-3 border-b-2 border-black min-h-5 px-1.5 text-right text-[11px] leading-tight break-all">
                            {vo.voNumber}
                        </div>
                    </div>

                    <div className="flex justify-between items-start gap-4 mb-4 border-b border-black pb-4">
                        <div className="text-left font-bold text-[14px] leading-tight">VARIATION ORDER</div>
                        <div className="max-w-[75%] text-right font-bold text-[12px] leading-tight">
                            <div>เอกสารนี้เป็นใบสั่งเปลี่ยนแปลงงาน (เพิ่ม/ลด) ที่มีผลต่องบประมาณโครงการ</div>
                            <div className="mt-1 break-words">{projectName || ""}</div>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-[11px] font-medium mt-2">
                        <thead>
                            <tr>
                                <th className="border border-black py-1.5 px-1 text-center w-10 font-bold">ลำดับ</th>
                                <th className="border border-black py-1.5 px-2 text-center w-20 font-bold">ประเภท</th>
                                <th className="border border-black py-1.5 px-2 text-center font-bold">รายละเอียดงาน/วัสดุ</th>
                                <th className="border border-black py-1.5 px-1 text-center w-16 font-bold">จำนวน</th>
                                <th className="border border-black py-1.5 px-1 text-center w-16 font-bold">หน่วย</th>
                                <th className="border border-black py-1.5 px-2 text-center w-28 font-bold">ราคา/หน่วย</th>
                                <th className="border border-black py-1.5 px-2 text-center w-28 font-bold">ผลกระทบงบ</th>
                            </tr>
                        </thead>
                        <tbody>
                            {vo.items.map((item, index) => {
                                const amount = Number(item.amount) || 0;
                                const signedAmount = item.type === "add" ? Math.abs(amount) : -Math.abs(amount);

                                return (
                                    <tr key={item.id || `${index}-${item.description}`} className="align-top">
                                        <td className="border-x border-black py-1.5 px-1 text-center">{index + 1}</td>
                                        <td className="border-x border-black py-1.5 px-2 text-center font-bold">{item.type === "add" ? "เพิ่ม" : "ลด"}</td>
                                        <td className="border-x border-black py-1.5 px-2">{item.description}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.quantity}</td>
                                        <td className="border-x border-black py-1.5 px-1 text-center">{item.unit}</td>
                                        <td className="border-x border-black py-1.5 px-2 text-right">{(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
                                        <td className="border-x border-black py-1.5 px-2 text-right font-bold">{toSignedCurrency(signedAmount)}</td>
                                    </tr>
                                );
                            })}

                            {Array.from({ length: emptyRowCount }).map((_, index) => (
                                <tr key={`empty-row-${index}`} className="align-top h-8">
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-2"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-1 text-center"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-right"></td>
                                    <td className="border-x border-black py-1.5 px-2 text-right"></td>
                                </tr>
                            ))}

                            <tr>
                                <td colSpan={5} className="border-x border-t border-black py-1 px-2 font-bold text-xs align-bottom">
                                    เหตุผล/รายละเอียดเพิ่มเติม: {vo.reason || "ไม่ระบุ"}
                                </td>
                                <td className="border border-black py-1.5 px-2 text-center font-bold">Total Not Included Vat</td>
                                <td className="border border-black py-1.5 px-2 text-right">{toSignedCurrency(vo.subTotal || 0)}</td>
                            </tr>
                        </tbody>
                        <tfoot>
                            <tr>
                                <td className="border-x border-b-transparent p-0 align-top" colSpan={5}></td>
                                <td className="border border-black py-1.5 px-2 text-center font-bold">Vat {vo.vatRate || 0}%</td>
                                <td className="border border-black py-1.5 px-2 text-right">{toSignedCurrency(vo.vatAmount || 0)}</td>
                            </tr>
                            <tr>
                                <td className="border-x border-b border-black font-bold p-2 text-left h-20 text-[10px] align-top" colSpan={5}></td>
                                <td className="border border-black py-1.5 px-2 text-center font-bold">Total Included Vat</td>
                                <td className="border border-black py-1.5 px-2 text-right font-bold">{toSignedCurrency(vo.totalAmount || 0)}</td>
                            </tr>
                        </tfoot>
                    </table>

                    <div className="grid grid-cols-1 md:grid-cols-2 print:grid-cols-2 text-[11px] font-semibold mt-10 gap-8 pt-6">
                        <div className="text-center space-y-2">
                            <div className="h-12 w-56 border-b border-black mx-auto"></div>
                            <p>( {projectContactName || "................................................"} )</p>
                            <p className="font-bold text-xs">ผู้ควบคุมงาน</p>
                        </div>

                        <div className="text-center space-y-2">
                            {primarySignature ? (
                                <div className="space-y-2 flex flex-col items-center">
                                    {primarySignature.signatureUrl ? (
                                        <div className="h-12 w-56 border-b border-black flex items-end justify-center">
                                            <img src={primarySignature.signatureUrl} alt="Signature" className="max-h-full max-w-full object-contain" />
                                        </div>
                                    ) : (
                                        <div className="h-12 w-56 border-b border-black"></div>
                                    )}
                                    <p>{primarySignature.name || "( ................................................ )"}</p>
                                    <p className="font-bold text-xs">{primarySignature.position || "ผู้อนุมัติ"}</p>
                                </div>
                            ) : (
                                <div className="space-y-2 flex flex-col items-center">
                                    <div className="h-12 w-56 border-b border-black"></div>
                                    <p>( ................................................ )</p>
                                    <p className="font-bold text-xs">ผู้อนุมัติ</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
