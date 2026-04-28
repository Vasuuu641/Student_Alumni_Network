export type RootStackParamList = {
  Home: undefined;
  Login: { registeredEmail?: string } | undefined;
  Register: undefined;
  Dashboard: undefined;
  Profile: undefined;
  Discussions: undefined;
  ThreadDetail: { threadId: string };
};
