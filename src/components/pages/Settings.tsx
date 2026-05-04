import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Building2, 
  MapPin, 
  Plus, 
  Trash2, 
  Save, 
  Shield, 
  Image as ImageIcon,
  Lock,
  X,
  Download,
  Upload
} from 'lucide-react';
import { useData } from '../../contexts/DataContext';
import { db, doc, setDoc, collection, addDoc, deleteDoc } from '../../firebase';
import { writeBatch } from 'firebase/firestore';
import { cn } from '../../lib/utils';
import { Branch } from '../../types';
import * as XLSX from 'xlsx';

export const Settings: React.FC = () => {
  const { companySettings, branches, sectors, managements, costCenterDepts } = useData();
  const [loading, setLoading] = useState(false);
  
  const [addingBranch, setAddingBranch] = useState(false);
  const [newBranch, setNewBranch] = useState('');
  
  const [addingSector, setAddingSector] = useState(false);
  const [newSector, setNewSector] = useState('');

  const [addingManagement, setAddingManagement] = useState(false);
  const [newManagement, setNewManagement] = useState('');

  const [addingCostCenterDept, setAddingCostCenterDept] = useState(false);
  const [newCostCenterDept, setNewCostCenterDept] = useState('');
  const [selectedSectorForDept, setSelectedSectorForDept] = useState('');
  
  // Local state for settings form
  const [formData, setFormData] = useState({
    companyName: companySettings?.companyName || '',
    logoUrl: companySettings?.logoUrl || '',
    systemPassword: companySettings?.systemPassword || '',
    iqamaAlertDays: companySettings?.iqamaAlertDays || 3,
  });

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await setDoc(doc(db, 'companySettings', 'main'), formData);
    } catch (error) {
      console.error('Error saving settings:', error);
      alert('حدث خطأ في حفظ الإعدادات، يرجى التحقق من الصلاحيات.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 500 * 1024) { // 500KB limit for Base64
        alert('حجم الصورة كبير جداً، يرجى اختيار شعار أقل من 500 كيلوبايت');
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, logoUrl: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAddBranch = async () => {
    const name = newBranch.trim();
    if (!name) return;
    
    setAddingBranch(true);
    try {
      // Use setDoc with an auto-generated ID for more explicit control
      const newBranchRef = doc(collection(db, 'branches'));
      await setDoc(newBranchRef, { name });
      
      setNewBranch('');
      alert('تم إضافة الفرع "' + name + '" بنجاح');
    } catch (error: any) {
      console.error('Error adding branch:', error);
      const errorMsg = error.message || 'خطأ غير معروف';
      if (errorMsg.includes('permission')) {
        alert('فشلت الإضافة: ليس لديك صلاحية لإضافة فروع. يرجى التأكد من أنك مسؤول.');
      } else {
        alert('حدث خطأ أثناء إضافة الفرع: ' + errorMsg);
      }
    } finally {
      setAddingBranch(false);
    }
  };

  const handleDeleteBranch = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الفرع؟')) return;
    try {
      await deleteDoc(doc(db, 'branches', id));
    } catch (error) {
      console.error('Error deleting branch:', error);
    }
  };

  const handleAddSector = async () => {
    const name = newSector.trim();
    if (!name) return;
    setAddingSector(true);
    try {
      await setDoc(doc(collection(db, 'sectors')), { name });
      setNewSector('');
    } catch (error) {
      console.error('Error adding sector:', error);
    } finally {
      setAddingSector(false);
    }
  };

  const handleDeleteSector = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف القطاع؟')) return;
    try {
      await deleteDoc(doc(db, 'sectors', id));
    } catch (error) {
      console.error('Error deleting sector:', error);
    }
  };

  const handleAddManagement = async () => {
    const name = newManagement.trim();
    if (!name) return;
    setAddingManagement(true);
    try {
      await setDoc(doc(collection(db, 'managements')), { name });
      setNewManagement('');
    } catch (error) {
      console.error('Error adding management:', error);
    } finally {
      setAddingManagement(false);
    }
  };

  const handleDeleteManagement = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف الإدارة؟')) return;
    try {
      await deleteDoc(doc(db, 'managements', id));
    } catch (error) {
      console.error('Error deleting management:', error);
    }
  };

  const handleAddCostCenterDept = async () => {
    const name = newCostCenterDept.trim();
    if (!name || !selectedSectorForDept) return;
    setAddingCostCenterDept(true);
    try {
      await setDoc(doc(collection(db, 'costCenterDepts')), { 
        name, 
        sectorName: selectedSectorForDept 
      });
      setNewCostCenterDept('');
      setSelectedSectorForDept('');
    } catch (error) {
      console.error('Error adding cost center dept:', error);
    } finally {
      setAddingCostCenterDept(false);
    }
  };

  const handleDeleteCostCenterDept = async (id: string) => {
    if (!confirm('هل أنت متأكد من حذف مركز التكلفة / القسم؟')) return;
    try {
      await deleteDoc(doc(db, 'costCenterDepts', id));
    } catch (error) {
      console.error('Error deleting cost center dept:', error);
    }
  };

  const handleExportBranches = () => {
    const data = branches.map(b => ({ 'اسم الفرع': b.name }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Branches");
    XLSX.writeFile(wb, `Branches_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportBranches = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const batch = writeBatch(db);
      data.forEach((row) => {
        const name = row['اسم الفرع'] || row['Name'] || row['name'] || row['الفرع'] || row['صاحب العمل الرسمي'];
        if (name) {
          const docRef = doc(collection(db, 'branches'));
          batch.set(docRef, { name: String(name).trim() });
        }
      });

      try {
        await batch.commit();
        alert('تم استيراد الفروع بنجاح');
      } catch (error) {
        console.error('Error importing branches:', error);
        alert('حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportSectors = () => {
    const data = sectors.map(s => ({ 'اسم القطاع': s.name }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sectors");
    XLSX.writeFile(wb, `Sectors_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportSectors = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const batch = writeBatch(db);
      data.forEach((row) => {
        const name = row['اسم القطاع'] || row['القطاع'] || row['Sector Name'] || row['Name'];
        if (name) {
          const docRef = doc(collection(db, 'sectors'));
          batch.set(docRef, { name: String(name).trim() });
        }
      });

      try {
        await batch.commit();
        alert('تم استيراد القطاعات بنجاح');
      } catch (error) {
        console.error('Error importing sectors:', error);
        alert('حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportManagements = () => {
    const data = managements.map(m => ({ 'اسم مركز التكلفة رئيسي': m.name }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Managements");
    XLSX.writeFile(wb, `CostCentersMain_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportManagements = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const batch = writeBatch(db);
      data.forEach((row) => {
        const name = row['اسم مركز التكلفة رئيسي'] || row['الإدارة'] || row['Management Name'] || row['Name'];
        if (name) {
          const docRef = doc(collection(db, 'managements'));
          batch.set(docRef, { name: String(name).trim() });
        }
      });

      try {
        await batch.commit();
        alert('تم استيراد مراكز التكلفة الرئيسية بنجاح');
      } catch (error) {
        console.error('Error importing managements:', error);
        alert('حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
  };

  const handleExportCostCenterDepts = () => {
    const data = costCenterDepts.map(ccd => ({ 
      'اسم مركز التكلفة / القسم': ccd.name,
      'القطاع المربوط': ccd.sectorName
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CostCenterDepts");
    XLSX.writeFile(wb, `CostCenterDepts_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const handleImportCostCenterDepts = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];

      const batch = writeBatch(db);
      data.forEach((row) => {
        const name = row['اسم مركز التكلفة / القسم'] || row['اسم القسم'] || row['الفرع'] || row['Name'];
        const sectorName = row['القطاع المربوط'] || row['القطاع'] || row['Sector'];
        if (name && sectorName) {
          const docRef = doc(collection(db, 'costCenterDepts'));
          batch.set(docRef, { 
            name: String(name).trim(),
            sectorName: String(sectorName).trim()
          });
        }
      });

      try {
        await batch.commit();
        alert('تم استيراد أقسام مراكز التكلفة بنجاح');
      } catch (error) {
        console.error('Error importing cost center depts:', error);
        alert('حدث خطأ أثناء الاستيراد');
      }
    };
    reader.readAsBinaryString(file);
  };

  return (
    <div className="space-y-8 pb-12">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Company Settings */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center text-blue-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-xl font-black text-gray-900">إعدادات المنشأة</h3>
              <p className="text-sm text-gray-500 font-medium">إدارة الهوية والاسم العام للنظام</p>
            </div>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-bold text-gray-700 mr-1">اسم المنشأة</label>
              <input
                type="text"
                value={formData.companyName}
                onChange={(e) => setFormData({ ...formData, companyName: e.target.value })}
                className="w-full bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                placeholder="أدخل اسم الشركة"
              />
            </div>

            <div className="space-y-4">
              <label className="text-sm font-bold text-gray-700 mr-1 block">شعار المنشأة</label>
              <div className="flex flex-col sm:flex-row items-center gap-6 p-6 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                <div className="relative group">
                  <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center overflow-hidden border border-gray-100 shadow-sm relative z-10">
                    {formData.logoUrl ? (
                      <img src={formData.logoUrl} alt="Logo Preview" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
                    ) : (
                      <ImageIcon className="w-8 h-8 text-gray-300" />
                    )}
                  </div>
                  {formData.logoUrl && (
                    <button 
                      type="button"
                      onClick={() => setFormData({ ...formData, logoUrl: '' })}
                      className="absolute -top-2 -left-2 w-6 h-6 bg-white border border-gray-200 text-red-500 rounded-full flex items-center justify-center shadow-lg z-20 hover:bg-red-50 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                
                <div className="flex-1 space-y-2 text-center sm:text-right">
                  <h4 className="text-sm font-bold text-gray-900">اختر صورة الشعار</h4>
                  <p className="text-xs text-gray-400 font-medium">يفضل استخدام صورة شفافة بصيغة PNG وبحجم أقل من 500 ك.ب</p>
                  
                  <div className="pt-2">
                    <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-white border border-gray-100 text-blue-600 rounded-xl font-bold cursor-pointer hover:bg-white shadow-sm transition-all border-b-2 active:border-b-0 active:translate-y-0.5">
                      <Plus className="w-4 h-4" />
                      <span>رفع من الجهاز</span>
                      <input 
                        type="file" 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                      />
                    </label>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 space-y-4">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <Shield className="w-5 h-5" />
                <h4 className="font-black">تنبيهات الإقامات</h4>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 mr-1">عدد أيام التنبيه قبل انتهاء الإقامة</label>
                <input
                  type="number"
                  value={formData.iqamaAlertDays}
                  onChange={(e) => setFormData({ ...formData, iqamaAlertDays: parseInt(e.target.value) || 0 })}
                  className="w-full bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-bold"
                  placeholder="مثال: 3"
                />
                <p className="text-xs text-gray-400 font-medium mr-1">هذا الرقم يحدد متى يبدأ النظام بتنبيهك بانتهاء إقامة الموظف</p>
              </div>
            </div>

            <div className="pt-4 border-t border-gray-50 space-y-4">
              <div className="flex items-center gap-3 text-red-600 mb-2">
                <Shield className="w-5 h-5" />
                <h4 className="font-black">حماية النظام</h4>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-gray-700 mr-1">كلمة مرور قفل النظام</label>
                <div className="relative">
                  <input
                    type="password"
                    value={formData.systemPassword}
                    onChange={(e) => setFormData({ ...formData, systemPassword: e.target.value })}
                    className="w-full bg-red-50/30 border-0 rounded-2xl p-4 pr-12 outline-none focus:ring-2 focus:ring-red-500/20 transition-all font-mono"
                    placeholder="••••••••"
                  />
                  <Lock className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                </div>
                <p className="text-xs text-gray-400 font-medium mr-1">هذه الكلمة تستخدم لقفل الشاشة وإعادة الدخول السريع</p>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20 disabled:opacity-50"
            >
              <Save className="w-5 h-5" />
              {loading ? 'جاري الحفظ...' : 'حفظ التغييرات'}
            </button>
          </form>
        </motion.div>

        {/* Branches Management */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900">إدارة الفروع / الكيانات</h3>
              <p className="text-sm text-gray-500 font-medium">إضافة وحذف الفروع (تظهر في ملف الموظف)</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all" title="استيراد اكسيل">
                <Upload className="w-5 h-5" />
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportBranches} />
              </label>
              <button 
                onClick={handleExportBranches}
                className="p-2 bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="تصدير اكسيل"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={newBranch}
                onChange={(e) => {
                  console.log('Input changed:', e.target.value);
                  setNewBranch(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddBranch();
                  }
                }}
                placeholder="اسم الفرع الجديد..."
                className="flex-1 bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/20 transition-all font-bold text-right shadow-inner"
              />
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  console.log('Add button clicked');
                  handleAddBranch();
                }}
                className={cn(
                  "px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[64px]",
                  newBranch.trim() ? "bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/25" : "bg-gray-200 text-gray-400 cursor-default"
                )}
              >
                {addingBranch ? (
                  <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Plus className="w-6 h-6" />
                )}
              </button>
            </div>

            <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
              {branches.map((branch) => (
                <div 
                  key={branch.id} 
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center text-gray-400 group-hover:text-indigo-600 transition-colors">
                      <MapPin className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-gray-700">{branch.name}</span>
                  </div>
                  <button 
                    onClick={() => handleDeleteBranch(branch.id)}
                    className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {branches.length === 0 && (
                <div className="text-center py-12">
                  <p className="text-gray-400 font-medium italic">لا يوجد فروع مضافة حالياً</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Sectors Management */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900">إدارة القطاعات</h3>
              <p className="text-sm text-gray-500 font-medium">إضافة وحذف القطاعات (تظهر في تقرير الملخص)</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all" title="استيراد اكسيل">
                <Upload className="w-5 h-5" />
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportSectors} />
              </label>
              <button 
                onClick={handleExportSectors}
                className="p-2 bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="تصدير اكسيل"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={newSector}
                onChange={(e) => setNewSector(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddSector()}
                placeholder="اسم القطاع الجديد..."
                className="flex-1 bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-amber-500/20 transition-all font-bold text-right shadow-inner"
              />
              <button
                onClick={handleAddSector}
                disabled={!newSector.trim() || addingSector}
                className={cn(
                  "px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[64px]",
                  newSector.trim() ? "bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/25" : "bg-gray-200 text-gray-400 cursor-default"
                )}
              >
                {addingSector ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-6 h-6" />}
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {sectors.map((sector) => (
                <div key={sector.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-colors">
                  <span className="font-bold text-gray-700">{sector.name}</span>
                  <button onClick={() => handleDeleteSector(sector.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Managements Management */}
        <motion.div 
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600">
              <Shield className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900">إعداد مركز التكلفة / رئيسي</h3>
              <p className="text-sm text-gray-500 font-medium">إضافة وحذف مراكز التكلفة الرئيسية</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all" title="استيراد اكسيل">
                <Upload className="w-5 h-5" />
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportManagements} />
              </label>
              <button 
                onClick={handleExportManagements}
                className="p-2 bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="تصدير اكسيل"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex gap-3">
              <input
                type="text"
                value={newManagement}
                onChange={(e) => setNewManagement(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddManagement()}
                placeholder="اسم مركز التكلفة الجديد..."
                className="flex-1 bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-emerald-500/20 transition-all font-bold text-right shadow-inner"
              />
              <button
                onClick={handleAddManagement}
                disabled={!newManagement.trim() || addingManagement}
                className={cn(
                  "px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[64px]",
                  newManagement.trim() ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-600/25" : "bg-gray-200 text-gray-400 cursor-default"
                )}
              >
                {addingManagement ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-6 h-6" />}
              </button>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {managements.map((m) => (
                <div key={m.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-colors">
                  <span className="font-bold text-gray-700">{m.name}</span>
                  <button onClick={() => handleDeleteManagement(m.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Cost Center / Dept Management */}
        <motion.div 
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm"
        >
          <div className="flex items-center gap-4 mb-8">
            <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
              <Building2 className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="text-xl font-black text-gray-900">إعداد مركز التكلفة / القسم</h3>
              <p className="text-sm text-gray-500 font-medium">إضافة وحذف مراكز التكلفة / الأقسام التفصيلية</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="p-2 bg-gray-50 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl cursor-pointer transition-all" title="استيراد اكسيل">
                <Upload className="w-5 h-5" />
                <input type="file" className="hidden" accept=".xlsx, .xls" onChange={handleImportCostCenterDepts} />
              </label>
              <button 
                onClick={handleExportCostCenterDepts}
                className="p-2 bg-gray-50 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all"
                title="تصدير اكسيل"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex flex-col gap-3">
              <select
                value={selectedSectorForDept}
                onChange={(e) => setSelectedSectorForDept(e.target.value)}
                className="w-full bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-bold text-right shadow-inner"
              >
                <option value="">اختر القطاع للربط...</option>
                <option value="الادارة العامة">الادارة العامة</option>
                <option value="قطاع ص المقاولات والمقاولات">قطاع ص المقاولات والمقاولات</option>
                <option value="ادارة العقار والاملاك">ادارة العقار والاملاك</option>
                <option value="قطاع الصناعة">قطاع الصناعة</option>
                <option value="قطاع السلع الكماليه">قطاع السلع الكماليه</option>
                <option value="قطاع ورش الصيانه و التصنيع">قطاع ورش الصيانه و التصنيع</option>
              </select>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={newCostCenterDept}
                  onChange={(e) => setNewCostCenterDept(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddCostCenterDept()}
                  placeholder="اسم القسم الجديد..."
                  className="flex-1 bg-gray-50 border-0 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-purple-500/20 transition-all font-bold text-right shadow-inner"
                />
                <button
                  onClick={handleAddCostCenterDept}
                  disabled={!newCostCenterDept.trim() || !selectedSectorForDept || addingCostCenterDept}
                  className={cn(
                    "px-6 rounded-2xl font-black transition-all shadow-lg active:scale-95 flex items-center justify-center min-w-[64px]",
                    (newCostCenterDept.trim() && selectedSectorForDept) ? "bg-purple-600 hover:bg-purple-700 text-white shadow-purple-600/25" : "bg-gray-200 text-gray-400 cursor-default"
                  )}
                >
                  {addingCostCenterDept ? <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Plus className="w-6 h-6" />}
                </button>
              </div>
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
              {costCenterDepts.map((ccd) => (
                <div key={ccd.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl group hover:bg-gray-100 transition-colors">
                  <div className="flex flex-col text-right">
                    <span className="font-bold text-gray-700">{ccd.name}</span>
                    <span className="text-xs text-gray-400 font-medium">{ccd.sectorName}</span>
                  </div>
                  <button onClick={() => handleDeleteCostCenterDept(ccd.id)} className="p-2 text-gray-400 hover:text-red-600 transition-colors">
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
              {costCenterDepts.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-gray-400 font-medium italic">لا يوجد مراكز تكلفة مضافة حالياً</p>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
