import { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import { searchLocalFoods, FOODS } from '../utils/foods';
import { parseMealAI, parseNutritionPanel, getAiUsage } from '../utils/gemini';
import { BarcodeScanner, BarcodeFormat } from '@capacitor-mlkit/barcode-scanning';
import { Camera, CameraSource, CameraResultType } from '@capacitor/camera';
import { normalizeBarcode, lookupProduct } from '../utils/barcode';
import { getCachedProduct, saveProduct, getAllCachedProducts } from '../utils/productCache';
import { ArrowLeft, X, Sparkles, Database, Search, Plus, Loader2, ScanBarcode, Camera as CameraIcon } from 'lucide-react';
import FoodLogDrawer from './FoodLogDrawer';

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'];

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'desi', label: 'Desi' },
  { id: 'protein', label: 'Protein' },
  { id: 'fast_food', label: 'Fast Food' },
  { id: 'italian', label: 'Italian' },
  { id: 'asian', label: 'Asian' },
  { id: 'middle_eastern', label: 'Middle Eastern' },
  { id: 'fruits', label: 'Fruits' },
  { id: 'vegetables', label: 'Vegetables' },
  { id: 'staples', label: 'Staples' },
  { id: 'nuts', label: 'Nuts' },
  { id: 'dairy', label: 'Dairy' },
  { id: 'beverages', label: 'Beverages' },
];

export default function AddFoodFlow() {
  const { addFlow, closeAddFood, logMeal } = useApp();
  const [view, setView] = useState(addFlow.mode || 'choose');
  const [mealType, setMealType] = useState(addFlow.mealType || 'breakfast');

  // Database view state
  const [dbQuery, setDbQuery] = useState('');
  const [dbCategory, setDbCategory] = useState('all');
  const [selectedFood, setSelectedFood] = useState(null);

  // AI view state
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [aiParsedMeal, setAiParsedMeal] = useState(null);

  // Scan view state
  const [scanBusy, setScanBusy] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanProduct, setScanProduct] = useState(null); // resolved product (food shape)
  const [scanMiss, setScanMiss] = useState(false);      // OFF has no entry for the code
  const [scanCode, setScanCode] = useState('');
  const [scanSource, setScanSource] = useState('');     // 'cache' | 'off' | 'photo' | 'manual'
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState({ name: '', calories: '', protein: '', carbs: '', fat: '' });
  // AI features run through Calobit's backend (no user key needed); free
  // accounts get AI_FREE_LIMIT calls per month, premium is unlimited.
  const ai = getAiUsage();

  // Cached scanned products surface in the local DB search too.
  const [dbScanned, setDbScanned] = useState([]);
  useEffect(() => {
    let alive = true;
    getAllCachedProducts().then(prods => { if (alive) setDbScanned(prods); });
    return () => { alive = false; };
  }, [scanProduct]);

  const dbResults = [
    // Scanned/cached products first (they have no category, so only under "All")
    ...(dbCategory === 'all'
      ? dbScanned
          .filter(f => f.hasNutrition !== false) // hide cached products with no nutrition data
          .filter(f => !dbQuery.trim() || (f.name || '').toLowerCase().includes(dbQuery.trim().toLowerCase()))
          .map(f => ({ ...f, category: 'scanned' }))
      : []),
    ...searchLocalFoods(dbQuery, dbCategory),
  ].slice(0, 30);

  const handleAnalyze = async () => {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    setAiError('');
    try {
      const parsed = await parseMealAI(aiInput.trim());
      if (parsed) {
        setAiParsedMeal({
          ...parsed,
          selectedType: parsed.type || mealType,
        });
      }
    } catch (err) {
      setAiError(err.message || 'Failed to analyze meal with Gemini AI.');
    } finally {
      setAiLoading(false);
    }
  };

  const handleConfirmLog = () => {
    if (!aiParsedMeal) return;
    logMeal({
      name: aiParsedMeal.meal_name || aiInput,
      meal_name: aiParsedMeal.meal_name || aiInput,
      calories: aiParsedMeal.totalCalories || 0,
      protein_g: aiParsedMeal.totalProtein || 0,
      carbs_g: aiParsedMeal.totalCarbs || 0,
      fat_g: aiParsedMeal.totalFat || 0,
      fiber_g: aiParsedMeal.totalFiber || 0,
      sugar_g: aiParsedMeal.totalSugar || 0,
      sodium_mg: aiParsedMeal.totalSodium || 0,
      type: aiParsedMeal.selectedType || mealType,
      items: aiParsedMeal.items || [],
    });
    closeAddFood();
    setAiParsedMeal(null);
  };

  const resetScan = () => {
    setScanError('');
    setScanMiss(false);
    setScanProduct(null);
    setScanSource('');
    setManualOpen(false);
  };

  const handleScanBarcode = async () => {
    setScanBusy(true);
    setScanError('');
    try {
      const perm = await BarcodeScanner.requestPermissions();
      if (perm.camera !== 'granted') {
        setScanError('Camera permission is needed to scan barcodes. Please allow it in your phone settings.');
        return;
      }
      const result = await BarcodeScanner.scan({
        formats: [BarcodeFormat.Ean13, BarcodeFormat.Ean8, BarcodeFormat.UpcA, BarcodeFormat.UpcE],
        autoZoom: true,
      });
      const barcode = result.barcodes?.[0];
      const raw = barcode?.rawValue || barcode?.displayValue;
      if (!raw) {
        setScanError('No barcode detected. Try framing the barcode again.');
        return;
      }
      const code = normalizeBarcode(raw);
      setScanCode(code);
      await handleCode(code);
    } catch (err) {
      if ((err.message || '').toLowerCase().includes('cancel')) return; // user dismissed the scanner
      setScanError(err.message || 'Scan failed. Please try again.');
    } finally {
      setScanBusy(false);
    }
  };

  const handleCode = async (code) => {
    if (!code) {
      setScanError('That barcode does not look valid. Try scanning again.');
      return;
    }
    setScanBusy(true);
    setScanError('');
    setScanMiss(false);
    setScanProduct(null);
    try {
      const cached = await getCachedProduct(code);
      if (cached) {
        setScanProduct(cached);
        setScanSource('cache');
        if (!cached.hasNutrition) setManualForm(f => ({ ...f, name: cached.name || '' }));
        return;
      }
      if (navigator.onLine === false) {
        setScanError("You're offline and this barcode isn't cached yet. Get back online to look it up, or enter it manually below.");
        setScanMiss(true);
        return;
      }
      const product = await lookupProduct(code);
      if (product) {
        await saveProduct(product);
        setScanProduct(product);
        setScanSource('off');
        if (!product.hasNutrition) setManualForm(f => ({ ...f, name: product.name || '' }));
      } else {
        setScanMiss(true);
      }
    } catch (err) {
      setScanError(err.message || 'Could not reach the food database. Check your connection.');
      setScanMiss(true);
    } finally {
      setScanBusy(false);
    }
  };

  const handlePhotoParse = async () => {
    setScanBusy(true);
    setScanError('');
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.Base64,
        quality: 80,
      });
      if (!photo.base64String) {
        setScanError('No photo was captured.');
        return;
      }
      const mime = photo.format === 'png' ? 'image/png' : 'image/jpeg';
      const parsed = await parseNutritionPanel(photo.base64String, mime);
      const product = {
        ...parsed,
        code: scanCode || `photo-${Date.now()}`,
        brand: '',
        quantity: '',
        imageUrl: '',
        source: 'photo',
        hasNutrition: true,
      };
      if (scanCode) await saveProduct(product); // cache so it logs offline forever after
      setScanProduct(product);
      setScanSource('photo');
    } catch (err) {
      setScanError(err.message || 'Could not read the nutrition panel. Try a clearer photo, or enter the values manually.');
    } finally {
      setScanBusy(false);
    }
  };

  const handleManualSubmit = () => {
    if (!manualForm.name.trim() || !manualForm.calories) {
      setScanError('Please enter at least a name and calories per 100g.');
      return;
    }
    const food = {
      name: manualForm.name.trim(),
      caloriesPer100g: Math.max(0, Math.round(parseFloat(manualForm.calories) || 0)),
      proteinPer100g: Math.max(0, parseFloat(manualForm.protein) || 0),
      carbsPer100g: Math.max(0, parseFloat(manualForm.carbs) || 0),
      fatPer100g: Math.max(0, parseFloat(manualForm.fat) || 0),
      code: scanCode || `manual-${Date.now()}`,
      brand: '',
      quantity: '',
      imageUrl: '',
      source: 'manual',
      hasNutrition: true,
    };
    if (scanCode) saveProduct(food); // cache manual entry too for repeat scans
    setScanProduct(food);
    setScanSource('manual');
    setManualOpen(false);
  };

  // Shared per-100g manual entry form (used when a barcode is missing or has no nutrition data).
  const renderManualForm = () => (
    <div className="fade-in" style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 8 }}>
      <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', marginBottom: 8 }}>
        Per 100g values
      </p>
      <div className="form-group" style={{ marginBottom: 8 }}>
        <label style={{ fontSize: 12, fontWeight: 600 }}>Food name</label>
        <input
          className="input-field"
          placeholder="e.g. Sooper Biscuits"
          value={manualForm.name}
          onChange={e => setManualForm({ ...manualForm, name: e.target.value })}
        />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {[
          { key: 'calories', label: '🔥 Calories (kcal)' },
          { key: 'protein', label: '💪 Protein (g)' },
          { key: 'carbs', label: '🌾 Carbs (g)' },
          { key: 'fat', label: '🧈 Fat (g)' },
        ].map(field => (
          <div className="form-group" key={field.key}>
            <label style={{ fontSize: 12, fontWeight: 600 }}>{field.label}</label>
            <input
              className="input-field"
              type="number"
              inputMode="decimal"
              placeholder="0"
              value={manualForm[field.key]}
              onChange={e => setManualForm({ ...manualForm, [field.key]: e.target.value })}
            />
          </div>
        ))}
      </div>
      <button className="btn-primary" style={{ width: '100%', marginTop: 10 }} onClick={handleManualSubmit}>
        Use These Values
      </button>
    </div>
  );

  return (
    <div style={{
      position: 'fixed', inset: 0, background: '#F9FAFB',
      zIndex: 1100, display: 'flex', flexDirection: 'column', height: '100%'
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 5, background: '#F9FAFB',
        padding: '14px 16px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0'
      }}>
        {view !== 'choose' ? (
          <button onClick={() => setView('choose')} style={{ background: 'none', padding: 6, display: 'flex', alignItems: 'center', gap: 4, color: '#4B5563', fontWeight: 600, fontSize: 14 }}>
            <ArrowLeft size={18} /> Back
          </button>
        ) : <span style={{ width: 60 }} />}
        <p style={{ fontSize: 17, fontWeight: 700 }}>Add Food</p>
        <button onClick={closeAddFood} style={{ background: 'none', padding: 6 }} aria-label="Close">
          <X size={22} color="#6B7280" />
        </button>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px 16px 120px' }}>
        {view === 'choose' && (
          <div className="fade-in">
            <h2 style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>How do you want to add food?</h2>
            <p style={{ fontSize: 14, color: '#6B7280', marginBottom: 24 }}>Pick a source below to find and log your meal.</p>

            <div className="selector-card" style={{ marginBottom: 12 }} onClick={() => setView('db')}>
              <span className="icon"><Database size={26} color="#14B8A6" /></span>
              <div className="info">
                <h4>Local Database</h4>
                <p>Search our built-in food library — works offline, no API key needed.</p>
              </div>
            </div>

            <div className="selector-card" style={{ marginBottom: 12 }} onClick={() => setView('scan')}>
              <span className="icon"><ScanBarcode size={26} color="#6366F1" /></span>
              <div className="info">
                <h4>Scan Barcode</h4>
                <p>Point your camera at a packet's barcode (chips, biscuits…) to look it up on Open Food Facts instantly.</p>
              </div>
            </div>

            <div className="selector-card" style={{ marginBottom: 12 }} onClick={() => setView('ai')}>
              <span className="icon"><Sparkles size={26} color="#a8cc2a" /></span>
              <div className="info">
                <h4>Gemini AI</h4>
                <p>Describe your meal in words and let AI estimate the nutrition. Requires your Gemini API key.</p>
              </div>
            </div>
          </div>
        )}

        {view === 'db' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Database size={18} color="#14B8A6" />
              <p style={{ fontSize: 15, fontWeight: 700 }}>Local Database Search</p>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              {dbResults.length} of {FOODS.length} foods available offline.
            </p>

            <div style={{ position: 'relative', marginBottom: 12 }}>
              <Search size={16} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input
                className="input-field"
                style={{ paddingLeft: 38 }}
                placeholder="Search food (e.g. Biryani, Omelette, Oats...)"
                value={dbQuery}
                onChange={e => setDbQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 8, marginBottom: 12, scrollbarWidth: 'none' }}>
              {CATEGORIES.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setDbCategory(cat.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                    whiteSpace: 'nowrap', border: 'none',
                    background: dbCategory === cat.id ? '#1A1A1A' : '#F3F4F6',
                    color: dbCategory === cat.id ? '#fff' : '#4B5563', cursor: 'pointer'
                  }}
                >
                  {cat.label}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {dbResults.length === 0 ? (
                <p style={{ fontSize: 13, color: '#9CA3AF', textAlign: 'center', padding: 24 }}>
                  No foods found. Try a different search or category.
                </p>
              ) : dbResults.map((food, idx) => (
                <div
                  key={food.name + idx}
                  onClick={() => setSelectedFood(food)}
                  style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 12px', background: '#fff', borderRadius: 10,
                    cursor: 'pointer', border: '1px solid #E5E7EB', transition: 'all 0.2s'
                  }}
                >
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A1A1A' }}>{food.name}</p>
                    <p style={{ fontSize: 11, color: '#6B7280' }}>
                      🔥 {food.caloriesPer100g} kcal / 100g • 💪 {food.proteinPer100g}g P • 🌾 {food.carbsPer100g}g C • 🧈 {food.fatPer100g}g F
                    </p>
                  </div>
                  <span style={{ background: '#C6F135', borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Plus size={14} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {view === 'ai' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <Sparkles size={18} color="#a8cc2a" />
              <p style={{ fontSize: 15, fontWeight: 700 }}>Gemini AI Meal Logger</p>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
              Describe what you ate in natural text, e.g. "2 boiled eggs, 2 slices of whole wheat toast with butter, and a coffee".
            </p>

            <textarea
              className="input-field"
              rows={4}
              style={{ marginBottom: 12 }}
              placeholder="Type your meal here..."
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
            />
            <button
              className="btn-primary"
              onClick={handleAnalyze}
              disabled={aiLoading || !aiInput.trim()}
              style={{ opacity: aiLoading || !aiInput.trim() ? 0.5 : 1 }}
            >
              {aiLoading ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
              {aiLoading ? 'Analyzing...' : 'Analyze Meal'}
            </button>
            {aiError && <p style={{ fontSize: 12, color: '#EF4444', marginTop: 8 }}>{aiError}</p>}
            {!aiInput.trim() && (
              <p style={{ fontSize: 12, color: '#9CA3AF', marginTop: 8 }}>
                Tip: add your Gemini API key in Profile → Settings to use AI.
              </p>
            )}
          </div>
        )}

        {view === 'scan' && (
          <div className="fade-in">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
              <ScanBarcode size={18} color="#6366F1" />
              <p style={{ fontSize: 15, fontWeight: 700 }}>Barcode Scanner</p>
            </div>
            <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 16 }}>
              Point your camera at the barcode on a packaged product. Found items are saved on your phone, so repeat scans work offline.
            </p>

            {scanBusy && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '18px 0', color: '#6B7280', fontSize: 13 }}>
                <Loader2 size={18} className="spin" /> {scanSource ? 'Looking up nutrition…' : 'Waiting for scan…'}
              </div>
            )}

            {!scanBusy && !scanProduct && !scanMiss && (
              <button className="btn-primary" style={{ width: '100%' }} onClick={handleScanBarcode}>
                <ScanBarcode size={16} /> Scan Barcode
              </button>
            )}

            {scanError && !scanProduct && (
              <p style={{ fontSize: 12, color: '#EF4444', marginTop: 10 }}>{scanError}</p>
            )}

            {/* Resolved product card */}
            {scanProduct && (
              <div className="card fade-in" style={{ padding: 16, borderRadius: 14, border: '1px solid #E5E7EB' }}>
                <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                  {scanProduct.imageUrl && (
                    <img
                      src={scanProduct.imageUrl}
                      alt=""
                      style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover', background: '#F3F4F6' }}
                      onError={e => { e.currentTarget.style.display = 'none'; }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 15, fontWeight: 700 }}>{scanProduct.name}</p>
                    {scanProduct.brand && <p style={{ fontSize: 12, color: '#6B7280' }}>{scanProduct.brand}</p>}
                    {scanProduct.quantity && <p style={{ fontSize: 11, color: '#9CA3AF' }}>{scanProduct.quantity}</p>}
                  </div>
                </div>

                {scanProduct.hasNutrition ? (
                  <>
                    <div style={{ background: '#F9FAFB', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: 6 }}>
                        📊 Nutrition (per 100g)
                      </p>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                        <div>🔥 <b>{scanProduct.caloriesPer100g}</b> kcal</div>
                        <div>💪 <b>{scanProduct.proteinPer100g}</b>g protein</div>
                        <div>🌾 <b>{scanProduct.carbsPer100g}</b>g carbs</div>
                        <div>🧈 <b>{scanProduct.fatPer100g}</b>g fat</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={resetScan}>Scan Again</button>
                      <button className="btn-primary" style={{ flex: 1.5 }} onClick={() => setSelectedFood(scanProduct)}>
                        <Plus size={16} /> Log Portion
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: '#FFF7E6', border: '1px solid #FDE68A', borderRadius: 10, padding: 12, marginBottom: 12 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#B45309', marginBottom: 4 }}>
                        ⚠️ No nutrition data in the database
                      </p>
                      <p style={{ fontSize: 12, color: '#92400E' }}>
                        Open Food Facts knows this product but has no per‑100g values for it. Add them from the label so your log stays accurate.
                      </p>
                    </div>

                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <button className="btn-secondary" style={{ flex: 1 }} onClick={resetScan}>Scan Again</button>
                      <button className="btn-primary" style={{ flex: 1.5 }} onClick={handlePhotoParse}>
                        <CameraIcon size={16} /> Read Label Photo
                      </button>
                    </div>
                    {!ai.premium && (
                      <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
                        💡 {ai.remaining} of {ai.limit} free AI calls left this month.
                      </p>
                    )}
                    <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={() => setManualOpen(v => !v)}>
                      {manualOpen ? 'Hide manual entry' : 'Enter Manually'}
                    </button>
                    {manualOpen && renderManualForm()}
                  </>
                )}
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 10 }}>
                  {scanSource === 'cache' ? '✓ Loaded from your offline saved products' :
                   scanSource === 'photo' ? '✓ Read from your nutrition panel photo' :
                   scanSource === 'manual' ? '✓ Entered by you' :
                   'via Open Food Facts'}
                </p>
              </div>
            )}

            {/* Not found in the database */}
            {scanMiss && !scanProduct && (
              <div className="card fade-in" style={{ padding: 16, borderRadius: 14, border: '1px solid #E5E7EB', marginTop: 4 }}>
                <p style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Not in the online database</p>
                <p style={{ fontSize: 12, color: '#6B7280', marginBottom: 12 }}>
                  This barcode isn't in Open Food Facts (common for local chips &amp; biscuits). You can still log it — read the nutrition panel with AI, or type the values.
                </p>

                <button className="btn-primary" style={{ width: '100%', marginBottom: 8 }} onClick={handlePhotoParse}>
                  <CameraIcon size={16} /> Read Nutrition Panel Photo
                </button>
                {!ai.premium && (
                  <p style={{ fontSize: 12, color: '#9CA3AF', marginBottom: 8 }}>
                    💡 {ai.remaining} of {ai.limit} free AI calls left this month.
                  </p>
                )}

                <button className="btn-secondary" style={{ width: '100%', marginBottom: 8 }} onClick={() => setManualOpen(v => !v)}>
                  {manualOpen ? 'Hide manual entry' : 'Enter Manually'}
                </button>

                {manualOpen && renderManualForm()}

                <button
                  onClick={resetScan}
                  style={{
                    width: '100%', padding: '10px 0', background: 'none', border: 'none',
                    color: '#4B5563', fontSize: 13, fontWeight: 600, cursor: 'pointer'
                  }}
                >
                  ↻ Try Another Barcode
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Log drawer for database results */}
      {selectedFood && (
        <FoodLogDrawer
          food={selectedFood}
          initialMealType={mealType}
          onClose={() => setSelectedFood(null)}
          onLogged={closeAddFood}
        />
      )}

      {/* AI parsed meal preview modal */}
      {aiParsedMeal && (
        <div className="fade-in" style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1200, padding: 20
        }}>
          <div className="card slide-up" style={{
            width: '100%', maxWidth: 440, background: '#fff', borderRadius: 16,
            padding: 20, position: 'relative', maxHeight: '90vh', overflowY: 'auto'
          }}>
            <button onClick={() => setAiParsedMeal(null)} style={{ position: 'absolute', right: 16, top: 16, background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} color="#6B7280" />
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
              <Sparkles size={18} color="#14B8A6" />
              <p style={{ fontSize: 13, fontWeight: 700, color: '#14B8A6' }}>Gemini AI Breakdown (Editable)</p>
            </div>

            <div style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>Meal Title</label>
              <input
                className="input-field"
                value={aiParsedMeal.meal_name || ''}
                onChange={e => setAiParsedMeal({ ...aiParsedMeal, meal_name: e.target.value })}
                style={{ fontWeight: 700, fontSize: 16 }}
              />
            </div>

            <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: 12, padding: 14, marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase' }}>Nutrition Values (Tap to Edit)</p>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>✏️ Editable</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <label style={{ fontSize: 11, color: '#6B7280', display: 'block', marginBottom: 2 }}>🔥 Calories (kcal)</label>
                  <input
                    className="input-field"
                    type="number"
                    value={aiParsedMeal.totalCalories}
                    onChange={e => setAiParsedMeal({ ...aiParsedMeal, totalCalories: Math.max(0, parseInt(e.target.value) || 0) })}
                    style={{ fontSize: 16, fontWeight: 800, padding: '4px 8px' }}
                  />
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <label style={{ fontSize: 11, color: '#14B8A6', display: 'block', marginBottom: 2 }}>💪 Protein (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.1"
                    value={aiParsedMeal.totalProtein}
                    onChange={e => setAiParsedMeal({ ...aiParsedMeal, totalProtein: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ fontSize: 16, fontWeight: 800, color: '#14B8A6', padding: '4px 8px' }}
                  />
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <label style={{ fontSize: 11, color: '#84CC16', display: 'block', marginBottom: 2 }}>🌾 Carbs (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.1"
                    value={aiParsedMeal.totalCarbs}
                    onChange={e => setAiParsedMeal({ ...aiParsedMeal, totalCarbs: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ fontSize: 16, fontWeight: 800, color: '#84CC16', padding: '4px 8px' }}
                  />
                </div>
                <div style={{ background: '#fff', padding: 8, borderRadius: 8, border: '1px solid #E5E7EB' }}>
                  <label style={{ fontSize: 11, color: '#F59E0B', display: 'block', marginBottom: 2 }}>🧈 Fat (g)</label>
                  <input
                    className="input-field"
                    type="number"
                    step="0.1"
                    value={aiParsedMeal.totalFat}
                    onChange={e => setAiParsedMeal({ ...aiParsedMeal, totalFat: Math.max(0, parseFloat(e.target.value) || 0) })}
                    style={{ fontSize: 16, fontWeight: 800, color: '#F59E0B', padding: '4px 8px' }}
                  />
                </div>
              </div>
            </div>

            {aiParsedMeal.items && aiParsedMeal.items.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 8 }}>Item Breakdown:</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 140, overflowY: 'auto' }}>
                  {aiParsedMeal.items.map((item, i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#F3F4F6', padding: '8px 10px', borderRadius: 8, fontSize: 12 }}>
                      <span style={{ fontWeight: 600 }}>{item.name}</span>
                      <span style={{ color: '#6B7280' }}>🔥 {item.calories} kcal | 💪 {item.protein_g}g P</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <p style={{ fontSize: 12, fontWeight: 700, color: '#4B5563', marginBottom: 6 }}>Log to Meal Time:</p>
            <div className="pill-tabs" style={{ marginBottom: 16 }}>
              {MEAL_TYPES.map(t => (
                <button
                  key={t}
                  className={`pill-tab ${aiParsedMeal.selectedType === t ? 'active' : ''}`}
                  onClick={() => setAiParsedMeal({ ...aiParsedMeal, selectedType: t })}
                >
                  {t.charAt(0).toUpperCase() + t.slice(1)}
                </button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-secondary" onClick={() => setAiParsedMeal(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn-primary" onClick={handleConfirmLog} style={{ flex: 1.5 }}>Log Meal ✓</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}