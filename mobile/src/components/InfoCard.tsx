import { Text, View } from 'react-native';
import { useTheme } from '../theme/theme';

type InfoCardProps = {
  icon: string;
  title: string;
  description: string;
  row?: boolean;
};

export function InfoCard({ icon, title, description, row = false }: InfoCardProps) {
  const { tokens } = useTheme();

  return (
    <View
      style={
        row
          ? { marginBottom: 10, flexDirection: 'row', alignItems: 'flex-start', borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 14 }
          : { marginBottom: 10, borderRadius: 16, borderWidth: 1, borderColor: tokens.border, backgroundColor: tokens.surface, padding: 16 }
      }
    >
      <Text style={row ? { marginTop: 2, width: 36, textAlign: 'center', fontSize: 22 } : { marginBottom: 8, fontSize: 22 }}>{icon}</Text>
      <View style={row ? { flex: 1, paddingLeft: 4 } : undefined}>
        <Text style={{ marginBottom: 4, fontSize: 16, fontWeight: '700', color: tokens.text }}>{title}</Text>
        <Text style={{ fontSize: 14, lineHeight: 20, color: tokens.muted }}>{description}</Text>
      </View>
    </View>
  );
}
