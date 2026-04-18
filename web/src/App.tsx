import { Navigate, Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage';
import { LoginPage } from './pages/LoginPage';
import { OnboardingPage } from './pages/Onboarding';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { NotesListPage } from './pages/NotesListPage';
import { NotePage } from './pages/NotePage';
import { ThreadsPage } from './pages/Threads';
import { ThreadDetailPage } from './pages/ThreadDetailPage';
import { StudyGroupsPage } from './pages/StudyGroups';
import { StudyGroupDetailPage } from './pages/StudyGroupDetailPage';
import { GeoHelpBoardPage } from './pages/GeoHelpBoardPage';
import { AdminLayout } from './pages/admin/AdminLayout';
import { AdminUsersPage } from './pages/admin/AdminUsersPage';
import { AdminGeoModerationPage } from './pages/admin/AdminGeoModerationPage';
import { AdminThreadsModerationPage } from './pages/admin/AdminThreadsModerationPage';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/onboarding" element={<OnboardingPage />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/notes" element={<NotesListPage />} />
      <Route path="/notes/:noteId" element={<NotePage />} />
      <Route path="/threads" element={<ThreadsPage />} />
      <Route path="/threads/:threadId" element={<ThreadDetailPage />} />
      <Route path="/study-groups" element={<StudyGroupsPage />} />
      <Route path="/study-groups/:groupId" element={<StudyGroupDetailPage />} />
      <Route path="/geo-help-board" element={<GeoHelpBoardPage />} />

      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<Navigate to="/admin/users" replace />} />
        <Route path="users" element={<AdminUsersPage />} />
        <Route path="geo-moderation" element={<AdminGeoModerationPage />} />
        <Route path="threads-moderation" element={<AdminThreadsModerationPage />} />
      </Route>
      <Route path="/geo-help-board" element={<GeoHelpBoardPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
