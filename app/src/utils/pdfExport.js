// Weekly PDF report export (free tier).
//
// Generates a clean PDF of the last 7 days: per-day meal log, goals vs
// average, weight trend and water average. Client-side via jsPDF — no server.
// Native: writes to the cache directory and opens with the file-opener.
// Web: downloads the file through a blob link.
import { jsPDF } from 'jspdf';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { FileOpener } from '@capacitor-community/file-opener';
import { getAllMeals, getWeights, getWater, getDateStr } from './storage';
import { sumMacros, sumNutrients } from './calculations';

const DAYS = 7;
const MEAL_TYPES = [
  ['breakfast', 'Breakfast', '🥞'],
  ['lunch', 'Lunch', '🍛'],
  ['dinner', 'Dinner', '🍽️'],
  ['snack', 'Snacks', '🍎'],
];

function dayStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return getDateStr(d);
}

function fmtDay(dateStr) {
  try {
    return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  } catch {
    return dateStr;
  }
}

function computeStreak(allMeals, goals) {
  let streak = 0;
  for (let i = 0; i < 30; i++) {
    const meals = allMeals[dayStr(i)] || [];
    if (sumMacros(meals).calories >= goals.calories * 0.8) streak++;
    else break;
  }
  return streak;
}

/** Build the PDF text layout. */
export function buildWeeklyPdf({ goals, profile } = {}) {
  const allMeals = getAllMeals();
  const goalsObj = goals || { calories: 2000, protein: 130, carbs: 250, fat: 65 };
  const streak = computeStreak(allMeals, goalsObj);
  const weights = getWeights();
  const todayStr = getDateStr();

  let daysLogged = 0;
  let totalKcal = 0;
  const perDayRows = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    const ds = dayStr(i);
    const meals = allMeals[ds] || [];
    const t = sumMacros(meals);
    const n = sumNutrients(meals);
    if (meals.length > 0) {
      daysLogged++;
      totalKcal += t.calories;
    }
    perDayRows.push({ date: ds, label: fmtDay(ds), meals, t, n });
  }

  const avgDaily = daysLogged ? Math.round(totalKcal / daysLogged) : 0;

  const doc = new jsPDF();
  const W = doc.internal.pageSize.getWidth();
  const M = 14;
  let y = 18;

  // Header
  doc.setFillColor(23, 26, 33);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(198, 241, 53);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('CALOBIT — Weekly Report', M, 15);
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fmtDay(dayStr(6))} – ${fmtDay(todayStr)}`, M, 23);
  doc.text(`Days logged: ${daysLogged}/${DAYS}   •   Streak: ${streak} day${streak === 1 ? '' : 's'}`, M, 29);
  y = 44;

  const line = () => {
    doc.setDrawColor(229, 231, 235);
    doc.line(M, y, W - M, y);
    y += 4;
  };
  const ensure = (needed) => {
    if (y + needed > 282) {
      doc.addPage();
      y = 18;
    }
  };

  // Goals overview
  doc.setTextColor(23, 26, 33);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Goals vs average', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  // macros averaged from the actual days
  let sumP = 0, sumC = 0, sumF = 0;
  for (const r of perDayRows) {
    sumP += r.t.protein; sumC += r.t.carbs; sumF += r.t.fat;
  }
  const avgP = daysLogged ? Math.round(sumP / daysLogged) : 0;
  const avgC = daysLogged ? Math.round(sumC / daysLogged) : 0;
  const avgF = daysLogged ? Math.round(sumF / daysLogged) : 0;
  [
    ['Calories (kcal)', goalsObj.calories, avgDaily],
    ['Protein (g)', goalsObj.protein, avgP],
    ['Carbs (g)', goalsObj.carbs, avgC],
    ['Fat (g)', goalsObj.fat, avgF],
  ].forEach(([label, goal, avg]) => {
    doc.text(label, M, y);
    doc.text(`goal ${goal}`, W / 2, y);
    doc.text(`avg ${avg}`, W - M, y, { align: 'right' });
    y += 6;
  });
  line();
  y += 4;

  // Daily meal log
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Daily meal log', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  for (const day of perDayRows) {
    if (day.meals.length === 0) continue;
    ensure(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(107, 114, 128);
    doc.text(day.label, M, y);
    y += 5;
    doc.setTextColor(23, 26, 33);
    doc.setFont('helvetica', 'normal');
    for (const mt of MEAL_TYPES) {
      const group = day.meals.filter((m) => m.type === mt[0]);
      for (const meal of group) {
        ensure(10);
        const name = (meal.name || meal.meal_name || 'Meal').slice(0, 42);
        const kcal = Math.round(meal.calories || 0);
        doc.text(`${mt[2]} ${name}`, M + 2, y);
        doc.text(`${kcal} kcal`, W - M, y, { align: 'right' });
        y += 5;
        const macros = `P ${Math.round(meal.protein_g || 0)}g · C ${Math.round(meal.carbs_g || 0)}g · F ${Math.round(meal.fat_g || 0)}g`;
        doc.setFontSize(8.5);
        doc.setTextColor(107, 114, 128);
        doc.text(macros, M + 10, y);
        doc.setFontSize(10);
        doc.setTextColor(23, 26, 33);
        y += 5;
      }
    }
    // Day totals
    ensure(8);
    doc.setFont('helvetica', 'bold');
    const dt = day.t;
    const dn = day.n;
    doc.text(
      `Day total: ${Math.round(dt.calories)} kcal · P ${Math.round(dt.protein)}g · C ${Math.round(dt.carbs)}g · F ${Math.round(dt.fat)}g` +
      `   Fiber ${Math.round(dn.fiber)}g · Sugar ${Math.round(dn.sugar)}g · Sodium ${Math.round(dn.sodium)}mg`,
      M, y
    );
    doc.setFont('helvetica', 'normal');
    y += 6;
  }

  // Weight trend
  const recent = weights.slice(-8);
  if (recent.length > 0) {
    ensure(16 + recent.length * 5);
    line();
    y += 4;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('Weight trend', M, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    for (const w of recent) {
      doc.text(fmtDay(w.date), M, y);
      doc.text(`${w.weight} kg`, W - M, y, { align: 'right' });
      y += 5;
    }
  }

  // Water average
  let waterTotal = 0;
  for (let i = 0; i < DAYS; i++) waterTotal += getWater(dayStr(i)) || 0;
  const waterAvg = Math.round((waterTotal / DAYS) * 10) / 10;
  ensure(10);
  line();
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('Hydration', M, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Average water: ${waterAvg} of 8 glasses / day`, M, y);
  y += 12;

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text(`Generated by CaloBit · ${new Date().toLocaleString()}`, M, y);

  return doc;
}

/** Generate + save/open the weekly PDF. Throws on failure. */
export async function exportWeeklyPdf(options = {}) {
  const doc = buildWeeklyPdf(options);
  const blob = doc.output('blob');
  const filename = `calobit-weekly-${getDateStr()}.pdf`;

  if (Capacitor.isNativePlatform()) {
    const base64 = doc.output('datauristring').split(',')[1];
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await FileOpener.open({ filePath: uri, contentType: 'application/pdf' });
    return { uri, filename };
  }

  // Web: download through a blob link.
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return { filename };
}
