import { useCallback, useEffect, useRef, useState } from 'react';
import type { Workout } from '../../types/domain';
import { api, ApiFailure } from '../../lib/api';
export function useWorkoutSave(initial: Workout, automatic: boolean) {
  const [workout, render] = useState(initial);
  const current = useRef(initial),
    version = useRef(initial.revision),
    stamp = useRef(initial.updated_at);
  const generation = useRef(0),
    savedGeneration = useRef(0),
    inflight = useRef<Promise<Workout> | null>(null);
  const [state, setState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [error, setError] = useState<unknown>(null);
  const retry = useRef<{ generation: number; input: Workout } | null>(null);
  const change = useCallback((patch: Partial<Workout>) => {
    if (
      Object.entries(patch).every(
        ([key, value]) =>
          JSON.stringify(current.current[key as keyof Workout]) === JSON.stringify(value),
      )
    )
      return;
    current.current = { ...current.current, ...patch };
    generation.current++;
    render(current.current);
    setState('dirty');
  }, []);
  const save = useCallback(
    async (complete = false): Promise<Workout> => {
      while (inflight.current) {
        await inflight.current;
        if (!complete && generation.current === savedGeneration.current) return current.current;
      }
      if (error instanceof ApiFailure && error.code === 'CONFLICT') throw error;
      const gen = generation.current;
      const input: Workout =
        retry.current?.generation === gen &&
        retry.current.input.status === (complete ? 'completed' : current.current.status)
          ? retry.current.input
          : {
              ...current.current,
              revision: version.current,
              updated_at: stamp.current,
              mutation_id: crypto.randomUUID(),
              ...(complete
                ? {
                    status: 'completed' as const,
                    end_at: current.current.end_at ?? new Date().toISOString(),
                  }
                : {}),
            };
      retry.current = { generation: gen, input };
      setState('saving');
      setError(null);
      const request = api<Workout>(
        `/api/fitness/sessions/${input.id}${complete ? '/complete' : ''}`,
        { method: 'PUT', body: input },
      );
      inflight.current = request;
      try {
        const result = await request;
        version.current = result.revision;
        stamp.current = result.updated_at;
        savedGeneration.current = gen;
        retry.current = null;
        current.current = {
          ...current.current,
          revision: result.revision,
          updated_at: result.updated_at,
          ...(complete ? { status: result.status, end_at: result.end_at } : {}),
        };
        render(current.current);
        setState(generation.current === gen ? 'saved' : 'dirty');
        return result;
      } catch (e) {
        setError(e);
        setState('error');
        throw e;
      } finally {
        inflight.current = null;
      }
    },
    [error],
  );
  useEffect(() => {
    if (
      !automatic ||
      state !== 'dirty' ||
      !workout.title.trim() ||
      (error instanceof ApiFailure && error.code === 'CONFLICT')
    )
      return;
    const timer = setTimeout(() => {
      void save().catch(() => {});
    }, 800);
    return () => clearTimeout(timer);
  }, [workout, automatic, state, save, error]);
  return { workout, change, save, state, error, dirty: state !== 'saved' };
}
