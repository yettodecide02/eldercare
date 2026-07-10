import { SafeAreaView } from 'react-native-safe-area-context';
import LiveTrackingScreen from '../../../src/screens/customer/LiveTrackingScreen';

export default function Track() {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['bottom']}>
      <LiveTrackingScreen />
    </SafeAreaView>
  );
}
