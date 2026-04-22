import { Button } from "@/components/ui/Button";

interface ProfileActionsProps {
  firstName: string;
  isSelf: boolean;
  onChallenge: () => void;
  onClose: () => void;
}

export function ProfileActions({
  firstName,
  isSelf,
  onChallenge,
  onClose,
}: ProfileActionsProps) {
  if (isSelf) {
    return (
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
      </div>
    );
  }
  return (
    <div className="flex justify-end gap-2">
      <Button variant="ghost" onClick={onClose}>
        Later
      </Button>
      <Button onClick={onChallenge}>{`Challenge ${firstName} →`}</Button>
    </div>
  );
}
