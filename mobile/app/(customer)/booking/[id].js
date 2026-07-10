import { SafeAreaView } from 'react-native-safe-area-context';
import BookingDetailScreen from '../../../src/screens/customer/BookingDetailScreen';

export default function BookingDetail() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <BookingDetailScreen />
    </SafeAreaView>
  );
}
