import { Text, View } from 'react-native';

type InfoCardProps = {
  icon: string;
  title: string;
  description: string;
  row?: boolean;
};

export function InfoCard({ icon, title, description, row = false }: InfoCardProps) {
  return (
    <View
      className={
        row
          ? 'mb-2.5 flex-row items-start rounded-2xl border border-[#e3eaf7] bg-white p-3.5'
          : 'mb-2.5 rounded-2xl border border-[#e7edf8] bg-white p-4'
      }
    >
      <Text className={row ? 'mt-0.5 w-9 text-center text-[22px]' : 'mb-2 text-[22px]'}>{icon}</Text>
      <View className={row ? 'flex-1 pl-1' : undefined}>
        <Text className="mb-1 text-base font-bold text-ink">{title}</Text>
        <Text className="text-sm leading-5 text-[#596b88]">{description}</Text>
      </View>
    </View>
  );
}
