import './global.css';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { DashboardPage, DiscussionsPage, HomePage, LoginPage, ProfilePage, RegisterPage, ThreadDetailPage, StudyGroupsPage, StudyGroupDetailPage } from './src/pages';
import type { RootStackParamList } from './src/navigation/root-stack';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Home"
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#ffffff' },
        }}
      >
        <Stack.Screen name="Home" component={HomePage} />
        <Stack.Screen name="Login" component={LoginPage} />
        <Stack.Screen name="Register" component={RegisterPage} />
        <Stack.Screen name="Dashboard" component={DashboardPage} />
        <Stack.Screen name="Profile" component={ProfilePage} />
        <Stack.Screen name="Discussions" component={DiscussionsPage} />
        <Stack.Screen name="ThreadDetail" component={ThreadDetailPage} />
        <Stack.Screen name="StudyGroups" component={StudyGroupsPage} />
        <Stack.Screen name="StudyGroupDetail" component={StudyGroupDetailPage} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
