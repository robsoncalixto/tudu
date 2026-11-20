"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { errorCode } from "@/lib/http";
import { agentApi, watchAgent } from "./api";
import { proposalDecisionSchema, type AgentState, type ProposalDecision } from "./schema";

export function useAgent() {
  const [state, setState] = useState<AgentState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [generating, setGenerating] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const version = useRef(0);
  const mounted = useRef(false);
  const pending = useRef(false);
  const reload = useCallback(async () => {
    const current = ++version.current;
    try {
      const latest = await agentApi.get();
      if (mounted.current && current === version.current) {
        setState(latest); setError(null);
        setErrors((errors) => Object.fromEntries(Object.entries(errors).filter(([id]) => latest.proposals.some((proposal) => proposal.id === id && ["pending", "applying"].includes(proposal.status)))));
      }
      return true;
    } catch (error) {
      if (mounted.current && current === version.current) setError(errorCode(error));
      return false;
    } finally { if (mounted.current && current === version.current) setLoading(false); }
  }, []);
  useEffect(() => {
    mounted.current = true; void reload();
    const stop = watchAgent(() => { if (!pending.current) void reload(); });
    return () => { mounted.current = false; ++version.current; stop(); };
  }, [reload]);

  async function propose(today: string, review = false) {
    if (pending.current || (!review && !text.trim()) || !state?.enabled) return;
    pending.current = true; setGenerating(true); setError(null); setEmpty(false); setSummary(null);
    try {
      const result = review ? await agentApi.review(text, today) : { summary: null, proposals: await agentApi.propose(text, today) };
      if (mounted.current) {
        setEmpty(result.proposals.length === 0);
        setSummary(result.summary);
        if (await reload()) setText("");
      }
    } catch (error) { if (mounted.current) setError(errorCode(error)); }
    finally { pending.current = false; if (mounted.current) setGenerating(false); }
  }
  async function decide(id: string, decision: ProposalDecision): Promise<boolean> {
    if (pending.current) return false;
    const parsed = proposalDecisionSchema.safeParse(decision);
    if (!parsed.success) { setErrors((current) => ({ ...current, [id]: "agent_invalid_proposal" })); return false; }
    pending.current = true; setBusyId(id); setErrors((current) => ({ ...current, [id]: undefined }));
    try {
      const proposal = await agentApi.decide(id, parsed.data);
      if (mounted.current) {
        setState((current) => current ? { ...current, proposals: current.proposals.map((saved) => saved.id === id ? proposal : saved) } : current);
        await reload();
      }
      return true;
    } catch (error) {
      if (mounted.current) { setErrors((current) => ({ ...current, [id]: errorCode(error) })); await reload(); }
      return false;
    } finally { pending.current = false; if (mounted.current) setBusyId(null); }
  }
  return { state, loading, error, text, setText, generating, empty, summary, busyId, errors, reload, propose, decide };
}
