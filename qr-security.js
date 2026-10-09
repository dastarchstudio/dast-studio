/* Permanent office attendance QR. Requires the employee to be logged in. */
(() => {
  const QR_VALUE = 'office';
  const QR_URL = () => location.origin + location.pathname + '?attendance_qr=' + QR_VALUE;
  const PENDING_KEY = 'dast_pending_attendance_qr';

  function renderPermanentQr() {
    const box = document.getElementById('attendance-qr');
    if (!box || !window.QRCode) throw new Error('QR library unavailable');
    box.innerHTML = '';
    new QRCode(box, {
      text: QR_URL(),
      width: 240,
      height: 240,
      correctLevel: QRCode.CorrectLevel.M
    });
  }

  window.openAttendanceQR = () => {
    const root = document.getElementById('edit-modal-root');
    if (!root) return;
    root.innerHTML = '<div class="overlay" onclick="if(event.target===this)closeAttendanceQrModal()"><div class="modal qr-modal" role="dialog" aria-modal="true" aria-labelledby="attendance-qr-title"><div class="qr-modal-head"><div><h3 id="attendance-qr-title">QR دائمی ورود و خروج</h3><p>یک‌بار چاپش کن و در محل ورود دفتر نصب کن.</p></div><span class="qr-static-badge">دائمی</span></div><div id="attendance-qr" class="qr-print-wrap qr-print-area" aria-label="QR دائمی ورود و خروج دفتر"></div><p class="qr-modal-note">این QR ثابت است. کارمند با اسکن آن، وارد حسابش می‌شود و ثبت ورود یا خروج را مستقیم انجام می‌دهد. خود QR اطلاعات حساب یا رمز عبور ندارد.</p><div class="modal-actions"><button class="btn secondary" onclick="window.print()">چاپ QR</button><button class="btn secondary" onclick="closeAttendanceQrModal()">بستن</button></div></div></div>';
    try {
      renderPermanentQr();
    } catch (_) {
      const box = document.getElementById('attendance-qr');
      if (box) box.textContent = 'نمایش QR در این مرورگر ممکن نشد.';
    }
  };

  window.closeAttendanceQrModal = () => {
    const root = document.getElementById('edit-modal-root');
    if (root) root.innerHTML = '';
  };

  window.consumeAttendanceQR = async () => {
    if (!currentUser) return;
    await toggleAttendance();
  };

  window.tryPendingAttendanceQR = async () => {
    if (!currentUser) return;
    const token = sessionStorage.getItem(PENDING_KEY);
    if (token !== QR_VALUE) return;
    sessionStorage.removeItem(PENDING_KEY);
    await window.consumeAttendanceQR();
  };

  setTimeout(() => window.tryPendingAttendanceQR?.(), 350);
})();