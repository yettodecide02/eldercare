import { SafeAreaView } from 'react-native-safe-area-context';
import OnboardingScreen from '../../src/screens/caregiver/OnboardingScreen';

export default function Onboarding() {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <OnboardingScreen />
    </SafeAreaView>
  );
}
