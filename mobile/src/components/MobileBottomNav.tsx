import { Pressable, Text, View } from 'react-native';
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome';
import {
  faBookOpen,
  faComments,
  faHouse,
  faUser,
} from '@fortawesome/free-solid-svg-icons';

export type MobileNavTab = 'home' | 'notes' | 'discussions' | 'profile';

type MobileBottomNavProps = {
  activeTab: MobileNavTab;
  onNavigate: (tab: MobileNavTab) => void;
};

const items: Array<{ key: MobileNavTab; label: string; icon: any }> = [
  { key: 'home', label: 'Home', icon: faHouse },
  { key: 'notes', label: 'Notes', icon: faBookOpen },
  { key: 'discussions', label: 'Discussions', icon: faComments },
  { key: 'profile', label: 'Profile', icon: faUser },
];

export function MobileBottomNav({ activeTab, onNavigate }: MobileBottomNavProps) {
  return (
    <View className="border-t border-[#e3ebf7] bg-white px-2 pt-2">
      <View className="flex-row items-stretch gap-1 pb-1">
        {items.map((item) => {
          const isActive = item.key === activeTab;

          return (
            <Pressable
              key={item.key}
              onPress={() => onNavigate(item.key)}
              className={`flex-1 items-center justify-center rounded-2xl py-2.5 ${
                isActive ? 'bg-[#eaf1ff]' : 'bg-transparent'
              }`}
            >
              <View
                className={`mb-1 h-8 w-8 items-center justify-center rounded-xl ${
                  isActive ? 'bg-[#2f64f6]' : 'bg-[#f2f6fd]'
                }`}
              >
                <FontAwesomeIcon
                  icon={item.icon}
                  size={14}
                  color={isActive ? '#ffffff' : '#7082a1'}
                />
              </View>
              <Text className={`text-[11px] font-semibold ${isActive ? 'text-[#2452c2]' : 'text-[#6a7b98]'}`}>
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}