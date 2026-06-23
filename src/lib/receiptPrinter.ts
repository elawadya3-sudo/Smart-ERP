import { Order, PrintTemplate } from '../types';
import { formatCurrency } from './utils';

interface PrintReceiptOptions {
  invoice: Order;
  templates: PrintTemplate[];
  settings: any;
  branchName: string;
  customer?: any;
  cashierName: string;
  isElectron: boolean;
  electronAPI?: any;
}

export function printReceiptHelper({
  invoice,
  templates,
  settings,
  branchName,
  customer,
  cashierName,
  isElectron,
  electronAPI
}: PrintReceiptOptions) {
  // 1. Find matching template linked to this branch
  const matchedTemplate = templates.find(t => t.linkedBranchIds?.includes(invoice.branchId));
  
  // 2. Extract values (either from template or settings fallback)
  const storeName = matchedTemplate?.companyName || settings?.storeName || 'متجرنا';
  const paperSize = matchedTemplate?.paperSize || settings?.receiptPaperSize || '80mm';
  const logoUrl = matchedTemplate?.logoUrl || settings?.storeLogoUrl || '';
  const showLogo = !!logoUrl;
  const taxNumber = matchedTemplate?.taxNumber || settings?.taxRegistrationNumber || '';
  const showTax = settings?.showTaxDetails ?? true; // fallback or toggle
  const headerMsg = matchedTemplate?.headerMessage || settings?.receiptHeader || '';
  const footerMsg = matchedTemplate?.footerMessage || settings?.receiptFooter || 'شكراً لتعاملكم معنا';
  
  const qrCodeEnabled = matchedTemplate ? matchedTemplate.qrCodeEnabled : true;
  const barcodeEnabled = matchedTemplate ? matchedTemplate.barcodeEnabled : true;

  const phone = settings?.phone || '';
  const email = settings?.branchEmail || '';
  const dateStr = new Date(invoice.createdAt || new Date()).toLocaleString('ar-EG');

  // 3. Group identical items (e.g., from different warehouses) for receipt printing
  const printItems: { key: string, name: string, quantity: number, price: number, total: number }[] = [];
  (invoice.items || []).forEach(item => {
    const key = item.variant 
      ? `${item.productId}-${item.variant.size}-${item.variant.color}`
      : item.productId;
    const existing = printItems.find(i => i.key === key);
    if (existing) {
      existing.quantity += item.quantity;
      existing.total += item.total;
    } else {
      printItems.push({
        key,
        name: item.name,
        quantity: item.quantity,
        price: item.price,
        total: item.total
      });
    }
  });

  const itemsHtml = printItems.map((item, index) => {
    if (paperSize === 'A4') {
      return `
        <tr>
          <td>${index + 1}</td>
          <td style="font-weight: 700;">${item.name}</td>
          <td style="text-align: center;">${item.quantity}</td>
          <td style="text-align: left;">${formatCurrency(item.price)}</td>
          <td style="text-align: left; font-weight: 700;">${formatCurrency(item.total)}</td>
        </tr>
      `;
    } else {
      return `
        <tr>
          <td style="padding: 4px 0; text-align: right; font-weight: bold;">
            <div>${item.name}</div>
            <div style="font-size: 8px; color: #666; font-weight: normal;">${formatCurrency(item.price)}/حبة</div>
          </td>
          <td style="padding: 4px 0; text-align: center; font-weight: bold;">${item.quantity}</td>
          <td style="padding: 4px 0; text-align: left; font-weight: bold;">${formatCurrency(item.total)}</td>
        </tr>
      `;
    }
  }).join('');

  // 4. Generate QR code link
  const qrData = `Store: ${storeName}\nInvoice: ${invoice.id}\nDate: ${dateStr}\nTotal: ${invoice.total}\nTax: ${invoice.tax || 0}\nTax Number: ${taxNumber}`;
  const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(qrData)}`;

  let html = '';

  if (paperSize === 'A4') {
    html = `
      <!DOCTYPE html><html dir="rtl"><head>
      <meta charset="utf-8">
      <title>فاتورة ضريبية مبسطة - ${invoice.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;750;900&display=swap');
        body { font-family: 'Cairo', system-ui, sans-serif; margin: 0; padding: 20px; color: #333; font-size: 13px; line-height: 1.5; }
        .invoice-box { max-width: 800px; margin: auto; border: 1px solid #eee; padding: 30px; border-radius: 20px; box-shadow: 0 0 10px rgba(0, 0, 0, 0.05); }
        .header-grid { display: grid; grid-template-columns: 1fr 1fr; align-items: center; margin-bottom: 30px; border-bottom: 2px solid #3b82f6; padding-bottom: 20px; }
        .logo { max-width: 100px; max-height: 100px; border-radius: 12px; }
        .invoice-details { text-align: left; }
        .invoice-details h1 { margin: 0 0 10px 0; color: #1e3a8a; font-size: 24px; font-weight: 900; }
        .info-grid { display: grid; gap: 20px; margin-bottom: 30px; }
        .info-card { background: #f8fafc; border: 1px solid #f1f5f9; padding: 15px; border-radius: 16px; }
        .info-card h3 { margin: 0 0 10px 0; font-size: 14px; color: #1e3a8a; font-weight: 800; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 30px; text-align: right; }
        th { background: #1e3a8a; color: white; padding: 12px; font-weight: 700; }
        td { padding: 12px; border-bottom: 1px solid #e2e8f0; }
        .totals-table { width: 250px; margin-right: auto; text-align: left; margin-bottom: 30px; }
        .totals-table td { padding: 8px 12px; border-bottom: none; }
        .totals-table tr.grand-total td { font-weight: 900; font-size: 16px; color: #1e3a8a; border-top: 2px solid #1e3a8a; }
        .footer { text-align: center; border-top: 1px solid #e2e8f0; padding-top: 20px; margin-top: 40px; color: #64748b; font-size: 11px; }
        .barcode-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 20px; }
        .barcode-container svg { max-width: 250px; height: auto; }
      </style></head><body>
      <div class="invoice-box">
        <div class="header-grid">
          <div style="display: flex; align-items: center; gap: 15px;">
            ${showLogo && logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ''}
            <div>
              <h2 style="margin: 0; font-size: 20px; font-weight: 900; color: #111;">${storeName}</h2>
              <p style="margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #4b5563;">${branchName}</p>
            </div>
          </div>
          <div class="invoice-details">
            <h1>فاتورة ضريبية مبسطة</h1>
            <p style="margin: 2px 0;">رقم الفاتورة: <span style="font-family: monospace; font-weight: bold;">${invoice.id}</span></p>
            <p style="margin: 2px 0;">التاريخ: ${dateStr}</p>
          </div>
        </div>

        <div class="info-grid" style="display: grid; grid-template-columns: ${customer ? '1fr 1fr 1fr' : '1fr 1fr'}; gap: 20px; margin-bottom: 30px;">
          <div class="info-card">
            <h3>معلومات المصدر</h3>
            <p style="margin: 4px 0;"><strong>الجهة:</strong> ${storeName} - ${branchName}</p>
            ${taxNumber ? `<p style="margin: 4px 0;"><strong>الرقم الضريبي:</strong> ${taxNumber}</p>` : ''}
            ${phone ? `<p style="margin: 4px 0;"><strong>الهاتف:</strong> ${phone}</p>` : ''}
            ${email ? `<p style="margin: 4px 0;"><strong>البريد الإلكتروني:</strong> ${email}</p>` : ''}
          </div>
          ${customer ? `
            <div class="info-card">
              <h3>معلومات العميل</h3>
              <p style="margin: 4px 0;"><strong>الاسم:</strong> ${customer.name}</p>
              ${customer.phone ? `<p style="margin: 4px 0;"><strong>الهاتف:</strong> ${customer.phone}</p>` : ''}
              ${customer.address ? `<p style="margin: 4px 0;"><strong>العنوان:</strong> ${customer.address}</p>` : ''}
            </div>
          ` : ''}
          <div class="info-card">
            <h3>تفاصيل الدفع والمبيعات</h3>
            <p style="margin: 4px 0;"><strong>طريقة الدفع:</strong> ${
              invoice.paymentMethod === 'cash' ? 'نقدي (كاش)' : 
              invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
              invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
              invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
              'آجل (على الحساب)'
            }</p>
            <p style="margin: 4px 0;"><strong>حالة الدفع:</strong> ${invoice.paymentMethod === 'debt' ? 'آجل (على الحساب)' : 'مدفوعة بالكامل'}</p>
            <p style="margin: 4px 0;"><strong>الكاشير:</strong> ${cashierName}</p>
            ${headerMsg ? `<p style="margin: 4px 0; color: #4b5563; font-style: italic;">"${headerMsg}"</p>` : ''}
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width: 5%;">#</th>
              <th>المنتج</th>
              <th style="text-align: center; width: 15%;">الكمية</th>
              <th style="text-align: left; width: 20%;">سعر الوحدة</th>
              <th style="text-align: left; width: 20%;">الإجمالي</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <div style="width: 50%;">
            ${qrCodeEnabled && taxNumber ? `
              <div style="border: 1px solid #e2e8f0; padding: 15px; border-radius: 12px; background: #fafafa; display: flex; align-items: center; gap: 15px;">
                <img src="${qrCodeUrl}" alt="QR Code" style="width: 80px; height: 80px; display: block;" />
                <div>
                  <div style="font-weight: 700; font-size: 11px; margin-bottom: 5px;">فاتورة ضريبية إلكترونية معتمدة</div>
                  <div style="color: #64748b; font-size: 10px; line-height: 1.4;">
                    خاضعة لأنظمة هيئة الزكاة والضريبة والجمارك واللوائح التنفيذية لضريبة القيمة المضافة.
                  </div>
                </div>
              </div>
            ` : ''}
          </div>
          <div>
            <table class="totals-table">
              ${showTax ? `
                <tr>
                  <td style="color: #64748b;">المجموع الفرعي</td>
                  <td style="text-align: left; font-weight: 700;">${formatCurrency(invoice.subtotal || invoice.total)}</td>
                </tr>
                ${invoice.tax > 0 ? `
                  <tr>
                    <td style="color: #64748b;">ضريبة القيمة المضافة (${settings?.taxRate || 15}%)</td>
                    <td style="text-align: left; font-weight: 700;">${formatCurrency(invoice.tax)}</td>
                  </tr>
                ` : ''}
              ` : ''}
              <tr class="grand-total">
                <td>الإجمالي النهائي</td>
                <td style="text-align: left;">${formatCurrency(invoice.total)}</td>
              </tr>
            </table>
          </div>
        </div>

        ${barcodeEnabled ? `
          <div class="barcode-container">
            <svg id="print-barcode-svg"></svg>
          </div>
        ` : ''}

        <div class="footer">
          ${settings?.returnDaysLimit !== undefined ? `
            <p style="margin: 0 0 8px 0; font-weight: bold; font-size: 11px; color: #334155;">
              سياسة الاسترجاع: ${settings.returnDaysLimit === 0 
                ? 'الاسترجاع غير مسموح به تماماً' 
                : `الاسترجاع مسموح خلال ${settings.returnDaysLimit} يوم من تاريخ الشراء`}
            </p>
          ` : ''}
          <p style="margin: 0; font-weight: 700;">${footerMsg}</p>
          <p style="margin: 5px 0 0 0; color: #94a3b8;">تم إنشاء هذه الفاتورة إلكترونياً عبر نظام نقاط البيع.</p>
        </div>
      </div>

      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <script>
        window.onload = function() {
          ${barcodeEnabled ? `
            try {
              JsBarcode("#print-barcode-svg", "${invoice.id}", {
                format: "CODE128",
                width: 1.6,
                height: 45,
                displayValue: true,
                fontSize: 11,
                margin: 0
              });
            } catch (e) {
              console.error("Barcode generation failed:", e);
            }
          ` : ''}
          setTimeout(function() {
            window.print();
            window.close();
          }, 350);
        }
      </script>
      </body></html>
    `;
  } else {
    // Thermal format (80mm or 58mm)
    const is80 = paperSize === '80mm';
    html = `
      <!DOCTYPE html><html dir="rtl"><head>
      <meta charset="utf-8">
      <title>فاتورة ${invoice.id}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap');
        @page { size: ${is80 ? '80mm' : '58mm'} auto; margin: 0; }
        body { 
          font-family: 'Cairo', system-ui, sans-serif; 
          font-size: ${is80 ? '11px' : '9px'}; 
          width: ${is80 ? '70mm' : '50mm'}; 
          margin: 0 auto; 
          padding: 8mm 4mm; 
          box-sizing: border-box; 
          color: #000; 
        }
        .header { text-align: center; margin-bottom: 5mm; }
        .logo { max-width: 65px; max-height: 65px; margin-bottom: 6px; border-radius: 50%; object-fit: contain; }
        .store-title { font-size: ${is80 ? '16px' : '13px'}; font-weight: 900; margin: 2px 0; color: #000; }
        .branch-title { font-size: ${is80 ? '12px' : '10.5px'}; font-weight: 700; margin: 2px 0; color: #333; }
        .meta-info { text-align: center; color: #333; font-size: ${is80 ? '9px' : '8px'}; font-weight: bold; margin-bottom: 4px; line-height: 1.4; }
        .divider { border-top: 1px dashed #000; margin: 3mm 0; }
        table { width: 100%; border-collapse: collapse; font-size: ${is80 ? '10px' : '8.5px'}; margin: 2mm 0; }
        th { text-align: right; padding: 4px 2px; border-bottom: 1px dashed #000; font-weight: 900; color: #000; }
        td { padding: 4px 2px; border-bottom: none; }
        .total-section { margin-top: 3mm; }
        .total-row { display: flex; justify-content: space-between; padding: 2px 0; font-weight: bold; }
        .grand-total { font-weight: 900; font-size: ${is80 ? '13px' : '11px'}; color: #000; margin-top: 2px; border-top: 1px dashed #000; padding-top: 4px; }
        .footer-msg { text-align: center; font-size: ${is80 ? '9px' : '8px'}; color: #555; margin-top: 4mm; line-height: 1.4; }
        .barcode-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin-top: 4mm; }
        .barcode-container svg { max-width: 90%; height: auto; }
      </style></head><body>
      <div class="header">
        ${showLogo && logoUrl ? `<img class="logo" src="${logoUrl}" alt="Logo" />` : ''}
        <div class="store-title">${storeName}</div>
        <div class="branch-title">${branchName}</div>
        ${headerMsg ? `<div style="font-size: ${is80 ? '10px' : '8px'}; font-weight: 700; color: #444; margin: 4px 0;">${headerMsg}</div>` : ''}
      </div>
      
      <div class="meta-info">
        <div>رقم الفاتورة: ${invoice.id}</div>
        <div>التاريخ: ${dateStr}</div>
        <div>الكاشير: ${cashierName}</div>
        ${taxNumber ? `<div>الرقم الضريبي: ${taxNumber}</div>` : ''}
        ${phone ? `<div>الهاتف: ${phone}</div>` : ''}
        ${customer ? `
          <div style="margin-top: 4px; padding-top: 4px; border-top: 1px dashed #000; font-weight: bold; text-align: right;">
            <div>العميل: ${customer.name}</div>
            ${customer.phone ? `<div>الهاتف: ${customer.phone}</div>` : ''}
          </div>
        ` : ''}
      </div>
      
      <div class="divider"></div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 55%;">الصنف</th>
            <th style="text-align: center; width: 15%;">الكمية</th>
            <th style="text-align: left; width: 30%;">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
      </table>
      
      <div class="divider"></div>
      
      <div class="total-section">
        ${showTax ? `
          <div class="total-row">
            <span>المجموع الفرعي:</span>
            <span>${formatCurrency(invoice.subtotal || invoice.total)}</span>
          </div>
          ${invoice.tax > 0 ? `
            <div class="total-row">
              <span>الضريبة (${settings?.taxRate || 15}%):</span>
              <span>${formatCurrency(invoice.tax)}</span>
            </div>
          ` : ''}
        ` : ''}
        <div class="total-row grand-total">
          <span>الإجمالي النهائي:</span>
          <span>${formatCurrency(invoice.total)}</span>
        </div>
        ${invoice.paymentMethod ? `
          <div class="total-row" style="font-size: ${is80 ? '9px' : '8px'}; color: #444; margin-top: 4px;">
            <span>طريقة الدفع:</span>
            <span>${
              invoice.paymentMethod === 'cash' ? 'نقدي' : 
              invoice.paymentMethod === 'visa' ? 'بطاقة ائتمان' : 
              invoice.paymentMethod === 'vodafone' ? 'فودافون كاش' : 
              invoice.paymentMethod === 'instapay' ? 'انستا باي' : 
              'آجل (على الحساب)'
            }</span>
          </div>
        ` : ''}
      </div>
      
      ${qrCodeEnabled && taxNumber ? `
        <div style="text-align: center; margin-top: 5mm;">
          <img src="${qrCodeUrl}" alt="QR" style="width: 70px; height: 70px; display: inline-block;" />
          <div style="font-size: 7px; color: #777; margin-top: 2px;">فاتورة إلكترونية معتمدة</div>
        </div>
      ` : ''}

      ${barcodeEnabled ? `
        <div class="barcode-container">
          <svg id="print-barcode-svg"></svg>
        </div>
      ` : ''}
      
      <div class="divider"></div>
      ${settings?.returnDaysLimit !== undefined ? `
        <div style="text-align: center; font-size: ${is80 ? '8.5px' : '7.5px'}; font-weight: bold; margin-bottom: 4px; line-height: 1.3;">
          سياسة الاسترجاع: ${settings.returnDaysLimit === 0 
            ? 'الاسترجاع غير مسموح به تماماً' 
            : `الاسترجاع مسموح خلال ${settings.returnDaysLimit} يوم من تاريخ الشراء`}
        </div>
      ` : ''}
      <div class="footer-msg">${footerMsg}</div>

      <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.5/dist/JsBarcode.all.min.js"></script>
      <script>
        window.onload = function() {
          ${barcodeEnabled ? `
            try {
              JsBarcode("#print-barcode-svg", "${invoice.id}", {
                format: "CODE128",
                width: ${is80 ? '1.4' : '1.1'},
                height: ${is80 ? '35' : '28'},
                displayValue: true,
                fontSize: 9,
                margin: 0
              });
            } catch (e) {
              console.error("Barcode generation failed:", e);
            }
          ` : ''}
          setTimeout(function() {
            window.print();
            window.close();
          }, 350);
        }
      </script>
      </body></html>
    `;
  }

  // 5. Trigger print action
  if (isElectron && electronAPI) {
    electronAPI.printThermal(html, { paperSize });
  } else {
    const w = window.open('', '_blank', paperSize === 'A4' ? 'width=900,height=900' : 'width=450,height=600');
    if (w) {
      w.document.write(html);
      w.document.close();
    }
  }
}
