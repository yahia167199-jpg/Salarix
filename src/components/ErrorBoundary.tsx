import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCcw } from 'lucide-react';
import { FirestoreErrorInfo } from '../firebase';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorInfo: FirestoreErrorInfo | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorInfo: null,
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    try {
      const parsed = JSON.parse(error.message) as FirestoreErrorInfo;
      if (parsed.error && parsed.authInfo) {
        return { hasError: true, errorInfo: parsed };
      }
    } catch {
      // Not a Firestore JSON error
    }
    return { hasError: true, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    window.location.reload();
  };

  public render() {
    const { hasError, errorInfo } = this.state;
    const { children } = this.props;

    if (hasError) {
      const isQuotaExceeded = errorInfo?.error?.includes('Quota exceeded') || 
                            errorInfo?.error?.includes('Quota limit exceeded');

      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-[2.5rem] shadow-2xl p-8 max-w-md w-full text-center space-y-6">
            <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto">
              <AlertCircle className="w-10 h-10" />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-gray-900">
                {isQuotaExceeded ? 'تجاوز حصة الاستخدام' : 'حدث خطأ ما'}
              </h2>
              <p className="text-gray-500 font-medium leading-relaxed">
                {isQuotaExceeded 
                  ? 'لقد تجاوزت حصة القراءة المجانية لليوم في Firestore. ستتم إعادة تعيين الحصة تلقائياً غداً.' 
                  : 'عذراً، حدث خطأ غير متوقع أثناء معالجة البيانات.'}
              </p>
              {isQuotaExceeded && (
                <p className="text-sm text-blue-600 font-bold bg-blue-50 p-3 rounded-2xl">
                  يمكنك مراجعة تفاصيل الحصص في خطة Spark عبر موقع Firebase الرسمي.
                </p>
              )}
            </div>

            <button
              onClick={this.handleReset}
              className="w-full py-4 bg-gray-900 hover:bg-black text-white font-black rounded-2xl transition-all flex items-center justify-center gap-2"
            >
              <RefreshCcw className="w-5 h-5" />
              تحديث الصفحة
            </button>
            
            {!isQuotaExceeded && errorInfo && (
              <div className="mt-4 p-4 bg-gray-100 rounded-2xl text-left overflow-auto max-h-40">
                <code className="text-xs text-gray-600">
                  {JSON.stringify(errorInfo, null, 2)}
                </code>
              </div>
            )}
          </div>
        </div>
      );
    }

    return children;
  }
}
