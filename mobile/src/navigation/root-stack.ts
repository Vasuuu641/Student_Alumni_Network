export type RootStackParamList = {
  Home: undefined;
  Login: { registeredEmail?: string } | undefined;
  Register: undefined;
  Dashboard: undefined;
  GeoHelpBoard: undefined;
  Profile: undefined;
  Discussions: undefined;
  ThreadDetail: { threadId: string };
  StudyGroups: undefined;
  StudyGroupDetail: { groupId: string };
  AdminLayout: undefined;
  AdminUsers: undefined;
  AdminGeoModeration: undefined;
  AdminThreadsModeration: undefined;
  Notes: undefined;
  NoteScreen: { noteId: string };
};
