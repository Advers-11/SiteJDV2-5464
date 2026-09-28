import { useMutation, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: orpc.tournaments.get.key() });
    void qc.invalidateQueries({ queryKey: orpc.tournaments.list.key() });
  };
}

export function useSetScore() {
  const invalidate = useInvalidate();
  return useMutation(orpc.matches.setScore.mutationOptions({ onSuccess: invalidate }));
}

export function useClearScore() {
  const invalidate = useInvalidate();
  return useMutation(orpc.matches.clearScore.mutationOptions({ onSuccess: invalidate }));
}

export function useResetAll() {
  const invalidate = useInvalidate();
  return useMutation(orpc.matches.resetAll.mutationOptions({ onSuccess: invalidate }));
}
