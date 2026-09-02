import { useRouter } from 'expo-router';
import { PendingApprovalScreen } from '@/components/PendingApprovalScreen';

export default function PendingApprovalRoute() {
  const router = useRouter();

  return (
    <PendingApprovalScreen
      onApproved={() => router.replace('/vehicle-owner/dashboard')}
    />
  );
}
