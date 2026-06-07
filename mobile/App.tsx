import './global.css';
import 'react-native-gesture-handler';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { enableScreens } from 'react-native-screens';
import { DashboardPage, DiscussionsPage, GeoHelpBoardPage, HomePage, LoginPage, ProfilePage, RegisterPage, ThreadDetailPage, StudyGroupsPage, StudyGroupDetailPage, AdminLayout, NotesListScreen, NoteScreen } from './src/pages';
import type { RootStackParamList } from './src/navigation/root-stack';
import { ThemeProvider } from './src/theme/theme';

enableScreens();

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
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
              <Stack.Screen name="GeoHelpBoard" component={GeoHelpBoardPage} />
              <Stack.Screen name="AdminLayout" component={AdminLayout} />
              <Stack.Screen name="Profile" component={ProfilePage} />
              <Stack.Screen name="Discussions" component={DiscussionsPage} />
              <Stack.Screen name="ThreadDetail" component={ThreadDetailPage} />
              <Stack.Screen name="StudyGroups" component={StudyGroupsPage} />
              <Stack.Screen name="StudyGroupDetail" component={StudyGroupDetailPage} />
              <Stack.Screen name="Notes" component={NotesListScreen} />
              <Stack.Screen name="NoteScreen" component={NoteScreen} />
            </Stack.Navigator>
          </NavigationContainer>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
