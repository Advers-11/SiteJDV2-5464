import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { orpc } from "../lib/api";
import { getEditToken, setEditToken } from "../lib/edit-token";

export function useTournaments(enabled: boolean) {
  return useQuery(orpc.tournaments.list.queryOptions({ enabled }));
}

export function useTournament(slug: string) {
  return useQuery(
    orpc.tournaments.get.queryOptions({
      input: { slug, editToken: getEditToken(slug) },
    }),
  );
}

function useInvalidate() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: orpc.tournaments.get.key() });
    void qc.invalidateQueries({ queryKey: orpc.tournaments.list.key() });
  };
}

export function useCreateTournament() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tournaments.create.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.tournaments.list.key() }),
    }),
  );
}

export function useDeleteTournament() {
  const qc = useQueryClient();
  return useMutation(
    orpc.tournaments.remove.mutationOptions({
      onSuccess: () => qc.invalidateQueries({ queryKey: orpc.tournaments.list.key() }),
    }),
  );
}

export function useUnlock(slug: string) {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.tournaments.unlock.mutationOptions({
      onSuccess: (data) => {
        setEditToken(slug, data.editToken);
        invalidate();
      },
    }),
  );
}

export function useUpdateTournament(slug: string) {
  const invalidate = useInvalidate();
  return useMutation(orpc.tournaments.update.mutationOptions({ onSuccess: invalidate }));
}

export function useRenameParticipant(slug: string) {
  const invalidate = useInvalidate();
  return useMutation(
    orpc.tournaments.renameParticipant.mutationOptions({ onSuccess: invalidate }),
  );
}

export function useShuffleSeeds(slug: string) {
  const invalidate = useInvalidate();
  return useMutation(orpc.tournaments.shuffleSeeds.mutationOptions({ onSuccess: invalidate }));
}

export function useSetEditPassword(slug: string) {
  const invalidate = useInvalidate();
  return useMutation(orpc.tournaments.setEditPassword.mutationOptions({ onSuccess: invalidate }));
}
