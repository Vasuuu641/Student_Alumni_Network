import { Pressable, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faBookOpen,
  faComments,
  faCompass,
  faHouse,
  faUsers,
} from '@fortawesome/free-solid-svg-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export type MobileNavTab = 'home' | 'notes' | 'discussions' | 'geo-board' | 'study-groups';

type MobileBottomNavProps = {
  activeTab: MobileNavTab;
  onNavigate: (tab: MobileNavTab) => void;
};

const items: Array<{ key: MobileNavTab; icon: any }> = [
  { key: 'home', icon: faHouse },
  { key: 'notes', icon: faBookOpen },
  { key: 'discussions', icon: faComments },
  { key: 'geo-board', icon: faCompass },
  { key: 'study-groups', icon: faUsers },
];

export function MobileBottomNav({ activeTab, onNavigate }: MobileBottomNavProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-[#f5f8ff] px-3 pt-2" style={{ paddingBottom: Math.max(insets.bottom, 10) }}>
      <View className="flex-row items-stretch gap-1 rounded-[24px] border border-[#dfe8f4] bg-white px-2 py-2 shadow-sm">
        {items.map((item) => {
          const isActive = item.key === activeTab;

          return (
            <Pressable
              key={item.key}
              onPress={() => onNavigate(item.key)}
              accessibilityRole="button"
              className={`flex-1 items-center justify-center rounded-2xl py-2.5 ${
                isActive ? 'bg-[#eaf1ff]' : 'bg-transparent'
              }`}
            >
              <View
                className={`h-9 w-9 items-center justify-center rounded-2xl ${
                  isActive ? 'bg-[#2f64f6]' : 'bg-[#f2f6fd]'
                }`}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  size={15}
                  color={isActive ? '#ffffff' : '#7082a1'}
                />
              </View>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}