import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Search, 
  Shield, 
  UserCheck, 
  UserX, 
  Trash2, 
  Mail,
  ShieldAlert,
  X as CloseIcon
} from 'lucide-react';
import { db, collection, setDoc, doc, deleteDoc, OperationType, handleFirestoreError } from '../../firebase';
import { useData } from '../../contexts/DataContext';
import { AppUser, UserRole } from '../../types';
import { cn } from '../../lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

export const UsersManagement: React.FC = () => {
  const { appUsers: users } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string, show: boolean }>({ id: '', show: false });
  
  const [formData, setFormData] = useState<Omit<AppUser, 'id' | 'createdAt'>>({
    email: '',
    name: '',
    role: 'Viewer',
    status: 'Active'
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.email.trim()) return;

    // Use email as ID
    const id = formData.email.toLowerCase();
    
    await setDoc(doc(db, 'users', id), {
      ...formData,
      email: formData.email.toLowerCase(),
      createdAt: new Date().toISOString()
    });

    setIsModalOpen(false);
    setFormData({ email: '', name: '', role: 'Viewer', status: 'Active' });
  };

  const handleDelete = async (id: string) => {
    await deleteDoc(doc(db, 'users', id));
    setDeleteConfirm({ id: '', show: false });
  };

  const filteredUsers = useMemo(() => {
    return users.filter(u => 
      ((u.name || '').toLowerCase()).includes((searchTerm || '').toLowerCase()) ||
      ((u.email || '').toLowerCase()).includes((searchTerm || '').toLowerCase())
    );
  }, [users, searchTerm]);

  const getRoleBadgeColor = (role: UserRole) => {
    switch (role) {
      case 'Admin': return 'bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-800';
      case 'HR': return 'bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800';
      case 'Finance': return 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800';
      default: return 'bg-gray-50 text-gray-600 border-gray-100 dark:bg-gray-800 dark:text-gray-400 dark:border-gray-700';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input 
            type="text" 
            placeholder="البحث عن مستخدم بالاسم أو البريد..."
            className="w-full pr-12 pl-4 py-3 bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium shadow-sm dark:text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
        >
          <Plus className="w-5 h-5" />
          <span>إضافة مستخدم جديد</span>
        </button>
      </div>

      {/* Users Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredUsers.map((u) => (
          <motion.div 
            layout
            key={u.id}
            className="bg-white dark:bg-gray-900 p-6 rounded-[2.5rem] border border-gray-100 dark:border-gray-800 shadow-sm hover:shadow-md transition-all group relative"
          >
            <div className="flex justify-between items-start mb-6">
                  <div className={cn(
                    "w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl",
                    u.role === 'Admin' ? "bg-purple-50 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400" : "bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                  )}>
                    {(u.name || 'U')[0].toUpperCase()}
                  </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => setDeleteConfirm({ id: u.id, show: true })}
                  className="p-2 text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 dark:text-white">{u.name}</h3>
                <div className="flex items-center gap-2 text-gray-400 dark:text-gray-500 text-sm font-medium">
                  <Mail className="w-3 h-3" />
                  {u.email}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black border",
                  getRoleBadgeColor(u.role)
                )}>
                  {u.role === 'Admin' ? 'مدير نظام' : u.role === 'HR' ? 'موارد بشرية' : u.role === 'Finance' ? 'مالية' : 'مشاهد'}
                </span>
                <span className={cn(
                  "px-3 py-1 rounded-full text-xs font-black border",
                  u.status === 'Active' ? "bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800" : "bg-red-50 text-red-600 border-red-100 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800"
                )}>
                  {u.status === 'Active' ? 'نشط' : 'معطل'}
                </span>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Add User Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white dark:bg-gray-900 w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800"
            >
              <div className="p-8 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between bg-gray-50/50 dark:bg-gray-800/50">
                <h3 className="text-2xl font-black text-gray-900 dark:text-white">إضافة مستخدم</h3>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white dark:hover:bg-gray-800 rounded-xl transition-colors">
                  <CloseIcon className="w-6 h-6 text-gray-400 dark:text-gray-500" />
                </button>
              </div>
              <form onSubmit={handleSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الاسم الكامل</label>
                    <input 
                      required
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium dark:text-white"
                      value={formData.name || ''}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">البريد الإلكتروني</label>
                    <input 
                      type="email"
                      required
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium dark:text-white"
                      value={formData.email || ''}
                      onChange={(e) => setFormData({...formData, email: e.target.value})}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-bold text-gray-500 dark:text-gray-400 mr-2">الصلاحية</label>
                    <select 
                      className="w-full px-5 py-3 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-medium dark:text-white"
                      value={formData.role}
                      onChange={(e) => setFormData({...formData, role: e.target.value as UserRole})}
                    >
                      <option value="Viewer" className="dark:bg-gray-900">مشاهد</option>
                      <option value="HR" className="dark:bg-gray-900">موارد بشرية</option>
                      <option value="Finance" className="dark:bg-gray-900">مالية</option>
                      <option value="Admin" className="dark:bg-gray-900">مدير نظام</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-4 pt-4">
                  <button 
                    type="submit"
                    className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-blue-200 dark:shadow-none"
                  >
                    إضافة المستخدم
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
      <AnimatePresence>
        {deleteConfirm.show && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setDeleteConfirm({ id: '', show: false })}
              className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-900 p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center border border-gray-100 dark:border-gray-800"
            >
              <div className="w-20 h-20 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <ShieldAlert className="w-10 h-10" />
              </div>
              <h3 className="text-xl font-black text-gray-900 dark:text-white mb-2">سحب الصلاحيات</h3>
              <p className="text-gray-500 dark:text-gray-400 font-medium mb-8">
                هل أنت متأكد من حذف هذا المستخدم؟ سيفقد القدرة على الوصول للنظام فوراً.
              </p>
              <div className="flex gap-3">
                <button 
                  onClick={() => handleDelete(deleteConfirm.id)}
                  className="flex-1 py-4 bg-red-600 hover:bg-red-700 text-white font-black rounded-2xl transition-all shadow-lg shadow-red-200 dark:shadow-none"
                >
                  نعم، احذف
                </button>
                <button 
                  onClick={() => setDeleteConfirm({ id: '', show: false })}
                  className="flex-1 py-4 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-black rounded-2xl transition-all hover:bg-gray-200 dark:hover:bg-gray-700"
                >
                  إلغاء
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
