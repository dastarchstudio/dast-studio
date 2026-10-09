import ExcelJS from 'exceljs';
import jalaali from 'jalaali-js';

const WEEKDAY_FA = ['یکشنبه', 'دوشنبه', 'سه شنبه', 'چهارشنبه', 'پنج شنبه', 'جمعه', 'شنبه'];
const TEHRAN_OFFSET_MS = 3.5 * 3600 * 1000; // ایران ساعت تابستانی ندارد

// تبدیل یک زمان UTC به مؤلفه‌های ساعت تهران
function toTehran(dateObj) {
  return new Date(dateObj.getTime() + TEHRAN_OFFSET_MS);
}
function timeStr(dateObj) {
  if (!dateObj) return '';
  const t = toTehran(dateObj);
  return `${String(t.getUTCHours()).padStart(2, '0')}:${String(t.getUTCMinutes()).padStart(2, '0')}`;
}
function hm(totalMinutes) {
  return `${Math.floor(totalMinutes / 60)}:${String(totalMinutes % 60).padStart(2, '0')}`;
}

export default async function handler(req, res) {
  try {
    const jy = parseInt(req.query.jy);
    const jm = parseInt(req.query.jm);

    if (!jy || !jm) {
      res.status(400).json({ error: 'سال و ماه شمسی لازم است' });
      return;
    }

    const daysInMonth = jalaali.jalaaliMonthLength(jy, jm);

    // بازه واکشی: از نیمه‌شب تهرانِ روز اول تا نیمه‌شب تهرانِ روز بعد از آخر
    const firstG = jalaali.toGregorian(jy, jm, 1);
    const lastG = jalaali.toGregorian(jy, jm, daysInMonth);
    const rangeStart = new Date(Date.UTC(firstG.gy, firstG.gm - 1, firstG.gd) - TEHRAN_OFFSET_MS);
    const rangeEnd = new Date(Date.UTC(lastG.gy, lastG.gm - 1, lastG.gd + 1) - TEHRAN_OFFSET_MS);

    const headers = {
      apikey: process.env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_KEY}`
    };

    const profilesRes = await fetch(`${process.env.SUPABASE_URL}/rest/v1/profiles?select=*`, { headers });
    const profiles = await profilesRes.json();
    if (!Array.isArray(profiles)) {
      res.status(500).json({ error: 'خواندن پروفایل‌ها ناموفق بود', details: profiles });
      return;
    }

    const attRes = await fetch(
      `${process.env.SUPABASE_URL}/rest/v1/attendance?check_in=gte.${rangeStart.toISOString()}&check_in=lt.${rangeEnd.toISOString()}&select=*&order=check_in.asc`,
      { headers }
    );
    const attendance = await attRes.json();
    if (!Array.isArray(attendance)) {
      res.status(500).json({ error: 'خواندن حضور و غیاب ناموفق بود', details: attendance });
      return;
    }

    const workbook = new ExcelJS.Workbook();

    for (const profile of profiles) {
      const records = attendance.filter(a => a.user_id === profile.id);
      const sheet = workbook.addWorksheet((profile.full_name || profile.id.slice(0, 8)).slice(0, 30));

      sheet.getCell('B3').value = `نام و نام خانوادگی: ${profile.full_name || ''}`;
      sheet.getRow(4).values = ['', 'روز', 'تاریخ', 'ساعت ورود', 'ساعت خروج', 'مجموع ساعت کار روزانه'];

      let rowIndex = 5;
      let weekTotalMinutes = 0;
      let monthTotalMinutes = 0;

      for (let d = 1; d <= daysInMonth; d++) {
        const g = jalaali.toGregorian(jy, jm, d);
        const dayUTC = Date.UTC(g.gy, g.gm - 1, g.gd);
        const weekday = new Date(dayUTC).getUTCDay();

        // همه رکوردهای این روز (بر اساس تاریخ تهران)
        const dayRecords = records.filter(r => {
          const t = toTehran(new Date(r.check_in));
          return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()) === dayUTC;
        });

        let minutes = 0;
        let firstIn = null;
        let lastOut = null;
        dayRecords.forEach(r => {
          const ci = new Date(r.check_in);
          if (!firstIn || ci < firstIn) firstIn = ci;
          if (r.check_out) {
            const co = new Date(r.check_out);
            if (!lastOut || co > lastOut) lastOut = co;
            minutes += Math.max(0, Math.round((co - ci) / 60000));
          }
        });

        sheet.getRow(rowIndex).values = [
          '',
          WEEKDAY_FA[weekday],
          `${jy}-${String(jm).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
          timeStr(firstIn),
          timeStr(lastOut),
          dayRecords.length ? hm(minutes) : ''
        ];
        rowIndex++;
        weekTotalMinutes += minutes;
        monthTotalMinutes += minutes;

        // پایان هفته (جمعه) یا آخر ماه
        if (weekday === 5 || d === daysInMonth) {
          sheet.getRow(rowIndex).values = ['', 'مجموع هفته', '', '', '', hm(weekTotalMinutes)];
          sheet.getRow(rowIndex).font = { bold: true };
          rowIndex++;
          weekTotalMinutes = 0;
        }
      }

      // جمع کل ماه
      rowIndex++;
      sheet.getRow(rowIndex).values = ['', 'جمع کل ساعت حضور در ماه', '', '', '', hm(monthTotalMinutes)];
      sheet.getRow(rowIndex).font = { bold: true, size: 12 };
      sheet.getCell('B3').value = `نام و نام خانوادگی: ${profile.full_name || ''}   |   جمع کل ساعت حضور: ${hm(monthTotalMinutes)}`;

      sheet.views = [{ rightToLeft: true }];
      sheet.columns = [{ width: 3 }, { width: 24 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 22 }];
    }

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=timesheet-${jy}-${jm}.xlsx`);
    res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: 'خطای داخلی', details: err.message });
  }
}
