import { SafeAreaView } from 'react-native-safe-area-context';
import CaregiverDetailScreen from '../../../src/screens/customer/CaregiverDetailScreen';

export default function CaregiverDetail() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <CaregiverDetailScreen />
    </SafeAreaView>
  );
}
