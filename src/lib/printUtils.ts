
export const printContent = (title: string, contentSource: string, isAr: boolean) => {
  let content = '';
  const element = document.getElementById(contentSource);
  
  if (element) {
    content = element.innerHTML;
  } else {
    // Treat as raw HTML string
    content = contentSource;
  }

  // Create a hidden iframe for printing
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = 'none';
  iframe.style.visibility = 'hidden';
  
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  
  // Fallback to window.open if iframe is not accessible
  if (!doc) {
    console.warn('[Print] Iframe document not accessible, falling back to window.open');
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Please allow popups for printing');
      return;
    }
    
    printWindow.document.write(`
      <html>
        <head>
          <title>${title}</title>
          <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
            body { font-family: 'Cairo', sans-serif; direction: ${isAr ? 'rtl' : 'ltr'}; background-color: white; color: black; padding: 40px; margin: 0; }
            .header { text-align: center; border-bottom: 3px double #d4af37; padding-bottom: 20px; margin-bottom: 30px; }
            .header h1 { margin: 0; font-size: 24px; color: #111; font-weight: 800; }
            .header p { margin: 6px 0; font-size: 13px; color: #555; font-weight: 700; }
            .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-bottom: 30px; font-size: 12px; border-bottom: 1px solid #eee; padding-bottom: 15px; }
            .meta-label { font-weight: 800; color: #111; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 11px; }
            th { background-color: #f8f8fa; color: #111; padding: 10px 8px; border: 1px solid #ddd; text-align: ${isAr ? 'right' : 'left'}; font-weight: 800; text-transform: uppercase; }
            td { padding: 10px 8px; border: 1px solid #eee; color: #333; }
            tr:nth-child(even) { background-color: #fafafc; }
            .font-mono { font-family: monospace; }
            .font-bold { font-weight: bold; }
            .text-emerald-400, .text-emerald-450 { color: #059669 !important; font-weight: 800; }
            .text-rose-400, .text-rose-450, .text-rose-500 { color: #dc2626 !important; font-weight: 800; }
            .text-[#d4af37] { color: #b28f28 !important; font-weight: 800; }
            .text-amber-500 { color: #d97706 !important; font-weight: 800; }
            .bg-indigo-950\/40 { background-color: #e0e7ff !important; color: #3730a3 !important; }
            .bg-amber-955\/20 { background-color: #fef3c7 !important; color: #92400e !important; }
            .bg-emerald-950\/40 { background-color: #d1fae5 !important; color: #065f46 !important; }
            .bg-purple-950\/30 { background-color: #f3e8ff !important; color: #6b21a8 !important; }
            .bg-rose-955\/20 { background-color: #fee2e2 !important; color: #991b1b !important; }
            .signatures { margin-top: 60px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; text-align: center; font-size: 13px; }
            .sig-line { margin-top: 50px; border-top: 1px dashed #999; padding-top: 10px; font-weight: 800; }
            .no-print { display: none !important; }
            @media print { body { padding: 0; } @page { margin: 1.5cm; } }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>AL-XPRESS LOGISTICS & CARGO GROUP</h1>
            <p>${isAr ? 'كشف الحسابات ومطابقات الأرصدة والعهد الرسمية' : 'OFFICIAL FINANCIAL RECONCILIATION STATEMENT'}</p>
            <p>${isAr ? 'تقرير نظام الحسابات المتقدم المتكامل' : 'AI-POWERED BALANCED TRIAL STATEMENT'}</p>
          </div>
          <div class="meta-grid">
            <div><span class="meta-label">${isAr ? 'تاريخ التصدير:' : 'Date Issued:'}</span> ${new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US')}</div>
            <div><span class="meta-label">${isAr ? 'المحاسب المسؤول:' : 'Verified by:'}</span> ALX-SYSTEM-ADMIN</div>
          </div>
          <div class="print-content">${content}</div>
          <div class="signatures">
            <div><p class="font-bold">${isAr ? 'توقيع المحاسب القانوني' : 'Finance Manager Signature'}</p><div class="sig-line"></div></div>
            <div><p class="font-bold">${isAr ? 'ختم الشركة والاعتماد' : 'Executive Corporate Seal'}</p><div class="sig-line"></div></div>
          </div>
          <script>
            window.onload = () => { setTimeout(() => { window.print(); }, 500); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
    return;
  }

  doc.write(`
    <html>
      <head>
        <title>${title}</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap" rel="stylesheet">
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;800&display=swap');
          
          body { 
            font-family: 'Cairo', sans-serif; 
            direction: ${isAr ? 'rtl' : 'ltr'}; 
            background-color: white; 
            color: black; 
            padding: 40px; 
            margin: 0; 
          }
          .header {
            text-align: center;
            border-bottom: 3px double #d4af37;
            padding-bottom: 20px;
            margin-bottom: 30px;
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            color: #111; 
            font-weight: 800;
          }
          .header p { 
            margin: 6px 0; 
            font-size: 13px; 
            color: #555; 
            font-weight: 700;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
            margin-bottom: 30px;
            font-size: 12px;
            border-bottom: 1px solid #eee;
            padding-bottom: 15px;
          }
          .meta-label { font-weight: 800; color: #111; }
          
          /* Table Styles */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 15px;
            font-size: 11px;
          }
          th {
            background-color: #f8f8fa;
            color: #111;
            padding: 10px 8px;
            border: 1px solid #ddd;
            text-align: ${isAr ? 'right' : 'left'};
            font-weight: 800;
            text-transform: uppercase;
          }
          td {
            padding: 10px 8px;
            border: 1px solid #eee;
            color: #333;
          }
          tr:nth-child(even) { background-color: #fafafc; }
          
          .font-mono { font-family: monospace; }
          .font-bold { font-weight: bold; }
          .text-emerald-400, .text-emerald-450 { color: #059669 !important; font-weight: 800; }
          .text-rose-400, .text-rose-450, .text-rose-500 { color: #dc2626 !important; font-weight: 800; }
          .text-[#d4af37] { color: #b28f28 !important; font-weight: 800; }
          .text-amber-500 { color: #d97706 !important; font-weight: 800; }
          
          .bg-indigo-950\\/40 { background-color: #e0e7ff !important; color: #3730a3 !important; }
          .bg-amber-955\\/20 { background-color: #fef3c7 !important; color: #92400e !important; }
          .bg-emerald-950\\/40 { background-color: #d1fae5 !important; color: #065f46 !important; }
          .bg-purple-950\\/30 { background-color: #f3e8ff !important; color: #6b21a8 !important; }
          .bg-rose-955\\/20 { background-color: #fee2e2 !important; color: #991b1b !important; }

          .signatures {
            margin-top: 60px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 50px;
            text-align: center;
            font-size: 13px;
          }
          .sig-line {
            margin-top: 50px;
            border-top: 1px dashed #999;
            padding-top: 10px;
            font-weight: 800;
          }
          
          /* Hide non-print elements if any leaked in */
          .no-print { display: none !important; }
          
          @media print {
            body { padding: 0; }
            @page { margin: 1.5cm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>AL-XPRESS LOGISTICS & CARGO GROUP</h1>
          <p>${isAr ? 'كشف الحسابات ومطابقات الأرصدة والعهد الرسمية' : 'OFFICIAL FINANCIAL RECONCILIATION STATEMENT'}</p>
          <p>${isAr ? 'تقرير نظام الحسابات المتقدم المتكامل' : 'AI-POWERED BALANCED TRIAL STATEMENT'}</p>
        </div>
        
        <div class="meta-grid">
          <div>
            <span class="meta-label">${isAr ? 'تاريخ التصدير:' : 'Date Issued:'}</span> ${new Date().toLocaleString(isAr ? 'ar-YE' : 'en-US')}
          </div>
          <div>
            <span class="meta-label">${isAr ? 'المحاسب المسؤول:' : 'Verified by:'}</span> ALX-SYSTEM-ADMIN
          </div>
        </div>

        <div class="print-content">
          ${content}
        </div>
        
        <div class="signatures">
          <div>
            <p class="font-bold">${isAr ? 'توقيع المحاسب القانوني' : 'Finance Manager Signature'}</p>
            <div class="sig-line"></div>
          </div>
          <div>
            <p class="font-bold">${isAr ? 'ختم الشركة والاعتماد' : 'Executive Corporate Seal'}</p>
            <div class="sig-line"></div>
          </div>
        </div>
      </body>
    </html>
  `);
  doc.close();

  // Focus and trigger printing inside the iframe
  const iframeWindow = iframe.contentWindow;
  if (iframeWindow) {
    setTimeout(() => {
      iframeWindow.focus();
      iframeWindow.print();
      
      // Clean up the iframe after a short delay so the print dialogue can start
      setTimeout(() => {
        if (document.body.contains(iframe)) {
          document.body.removeChild(iframe);
        }
      }, 2000);
    }, 500);
  }
};
