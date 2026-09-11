import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NavigationProvider, useNavigation } from './context/NavigationContext';
import { Layout } from './components/Layout';
import { ChatInterface } from './pages/ChatInterface';
import { AdminDashboard } from './pages/AdminDashboard';
import { UserReportPage } from './pages/UserReportPage';
import { DesignStudio } from './pages/DesignStudio';
import { TasksPage } from './pages/TasksPage';
import { TestingZone } from './pages/TestingZone';
import { TendersPage } from './pages/TendersPage';
import { ConveyorApp } from './components/conveyor/ConveyorApp';
import { OrgTasksPage } from './pages/OrgTasksPage';
import { SandboxPage } from './components/sandbox/SandboxPage';
import { Login } from './pages/Login';
import { UserRole } from './types';
import { Button } from './components/Button';
import { MessageCircle, X } from 'lucide-react';
import { CorporateChatSidebar } from './components/CorporateChatSidebar';
import { ManagerDashboard } from './components/dashboard/ManagerDashboard';

const KordaLogoLarge = () => (
  <img src="/logo.png" alt="Korda Logo" className="w-24 h-24 object-contain" />
);

const AppContent: React.FC = () => {
  const { user, isAuthenticated } = useAuth();
  const nav = useNavigation();

  if (!isAuthenticated) return <Login />;

  // Report Page (standalone, no Layout)
  if (nav.currentView === 'report' && nav.reportUserId && (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR || user?.role === UserRole.DIRECTOR || user?.role === UserRole.MANAGER)) {
    return (
      <div className="bg-slate-50 min-h-screen">
        <UserReportPage 
          userId={nav.reportUserId} 
          onBack={() => { 
            nav.setCurrentView('chat'); 
            if (user?.role !== UserRole.MANAGER) {
              nav.setIsAdminOpen(true); 
            }
          }} 
        />
      </div>
    );
  }

  // Resolve active content
  const activeChat = nav.chats.find(c => c.id === nav.currentChatId);

  const renderContent = () => {
    switch (nav.currentView) {
      case 'studio': return <DesignStudio />;
      case 'testing': return <TestingZone />;
      case 'tasks':
        return <TasksPage chats={nav.chats} onNavigateChat={nav.navigateChat} onSelectChat={(id) => nav.selectChat(id)} onCreateChat={nav.createChat} />;
      case 'tenders':
        return <TendersPage chats={nav.chats} onCreateChat={nav.createChat} />;
      case 'conveyor':
        return <ConveyorApp />;
      case 'org-tasks':
        return <OrgTasksPage />;
      case 'sandbox':
        return <SandboxPage />;
      case 'chat':
      default:
        return activeChat ? (
          <ChatInterface
            key={activeChat.id}
            chat={activeChat}
            onUpdateMessages={(msgs) => nav.updateMessages(activeChat.id, msgs)}
            onRenameChat={(title) => nav.renameChat(activeChat.id, title)}
            onToggleSidebar={nav.toggleSidebar}
            pendingInput={nav.pendingInput}
            onClearPendingInput={nav.clearPendingInput}
          />
        ) : (user?.role === UserRole.MANAGER || user?.role === UserRole.DIRECTOR || user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR) ? (
          <ManagerDashboard onViewReport={(userId) => {
            nav.setReportUserId(userId);
            nav.setCurrentView('report');
          }} />
        ) : (
          <div className="flex-1 overflow-y-auto w-full bg-slate-50">
            <div className="flex flex-col items-center justify-start md:justify-center min-h-full py-10 px-4 text-slate-500">
              <div className="w-40 h-40 mb-8 rounded-[2rem] bg-white flex items-center justify-center shadow-lg border border-slate-100 shrink-0">
                <KordaLogoLarge />
              </div>
              <h2 className="text-2xl font-bold text-slate-800 mb-2 text-center">Добро пожаловать в Korda Syntax</h2>
              <p className="max-w-md text-center mb-10 text-slate-600">
                Выберите диалог из списка слева, создайте новый или используйте дополнительные инструменты.
              </p>
            </div>
          </div>
        );
    }
  };

  return (
    <Layout hideMobileHeader={nav.currentView === 'chat' && !!nav.currentChatId}>
      {renderContent()}

      {/* Admin Overlay Panel */}
      {nav.isAdminOpen && (user?.role === UserRole.ADMIN || user?.role === UserRole.SUPERVISOR || user?.role === UserRole.DIRECTOR) && (
        <>
          <div className="fixed inset-0 z-[90] bg-black/30 backdrop-blur-sm transition-opacity" onClick={() => nav.setIsAdminOpen(false)} />
          <div className="fixed inset-x-0 top-0 bottom-0 z-[100] flex flex-col bg-slate-50 text-slate-800 animate-in slide-in-from-top duration-300 md:left-[280px]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-white shadow-sm shrink-0">
              <h1 className="text-xl font-bold flex items-center gap-2"><span className="text-korda-500">Korda</span> Admin</h1>
              <button onClick={() => nav.setIsAdminOpen(false)} className="p-2 rounded-lg hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition-colors" title="Закрыть админ-панель">
                <X size={24} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <AdminDashboard
                initialTab={nav.adminInitialTab as any}
                onViewReport={(userId) => {
                  nav.setReportUserId(userId);
                  nav.setAdminInitialTab('reports');
                  nav.setIsAdminOpen(false);
                  nav.setCurrentView('report');
                }}
              />
            </div>
          </div>
        </>
      )}

      {/* Corporate Chats FAB */}
      <button
        onClick={() => nav.setIsCorporateChatOpen(true)}
        className="fixed bottom-6 left-6 z-40 bg-korda-500 text-white rounded-full p-4 shadow-xl hover:bg-korda-600 transition-all hover:scale-105 flex items-center justify-center group"
      >
        <MessageCircle size={24} className="group-hover:animate-pulse" />
        {nav.corporateUnreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex h-5 w-5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 text-[10px] font-bold items-center justify-center border-2 border-white">
              {nav.corporateUnreadCount > 9 ? '9+' : nav.corporateUnreadCount}
            </span>
          </span>
        )}
      </button>

      {nav.isCorporateChatOpen && (
        <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity" onClick={() => nav.setIsCorporateChatOpen(false)} />
      )}
      <CorporateChatSidebar isOpen={nav.isCorporateChatOpen} onClose={() => nav.setIsCorporateChatOpen(false)} />
    </Layout>
  );
};

const App: React.FC = () => (
  <>
  <AuthProvider>
    <NavigationProvider>
      <AppContent />
    </NavigationProvider>
  </AuthProvider>
  </>
);

export default App;
