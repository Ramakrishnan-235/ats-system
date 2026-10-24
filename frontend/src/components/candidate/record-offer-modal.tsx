"use client";

import React, { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DollarSign } from "lucide-react";
import { CandidateDetail, OfferRecord } from "@/types/ats";
import { getErrorMessage, recordCandidateOffer } from "@/lib/api";

interface RecordOfferModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  candidate: CandidateDetail | null;
  onSuccess: (offer: OfferRecord) => void;
  onError: (errorMessage: string) => void;
}

export function RecordOfferModal({
  isOpen,
  onOpenChange,
  candidate,
  onSuccess,
  onError,
}: RecordOfferModalProps) {
  const [offerStatus, setOfferStatus] = useState("DRAFTED");
  const [offerSalary, setOfferSalary] = useState("145000");
  const [offerCurrency, setOfferCurrency] = useState("USD");
  const [offerEquity, setOfferEquity] = useState("0.15% Options");
  const [offerSignOn, setOfferSignOn] = useState("15000");
  const [offerStartDate, setOfferStartDate] = useState("");
  const [offerNotes, setOfferNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (candidate && isOpen) {
      Promise.resolve().then(() => {
        const currentOffer = candidate.offer;
        if (currentOffer) {
          setOfferStatus(currentOffer.status || "DRAFTED");
          setOfferSalary(String(currentOffer.base_salary || 145000));
          setOfferCurrency(currentOffer.currency || "USD");
          setOfferEquity(currentOffer.equity || "0.15% Options");
          setOfferSignOn(String(currentOffer.sign_on_bonus || 0));
          setOfferStartDate(currentOffer.start_date || "");
          setOfferNotes(currentOffer.notes || "");
        } else {
          setOfferStatus("DRAFTED");
          setOfferSalary("145000");
          setOfferCurrency("USD");
          setOfferEquity("0.15% Options");
          setOfferSignOn("15000");
          setOfferStartDate("");
          setOfferNotes("");
        }
      });
    }
  }, [candidate, isOpen]);

  const handleRecordOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!candidate || !candidate.applied_for_job_id) {
      onError("Please select an active target job requisition to record an offer.");
      return;
    }
    setIsSaving(true);
    try {
      const rec = await recordCandidateOffer(candidate.applied_for_job_id, candidate.id, {
        status: offerStatus,
        salary: Number(offerSalary) || 145000,
        currency: offerCurrency,
        equity: offerEquity.trim() || undefined,
        sign_on_bonus: Number(offerSignOn) || 0,
        start_date: offerStartDate || undefined,
        notes: offerNotes.trim() || undefined,
      });
      onSuccess(rec);
      onOpenChange(false);
    } catch (err) {
      onError(getErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg p-7 rounded-2xl bg-white border border-zinc-200 shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-zinc-950 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-[#6137e0]" />
            <span>Record / Update Offer Record</span>
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleRecordOffer} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Offer Status</label>
            <select
              value={offerStatus}
              onChange={(e) => setOfferStatus(e.target.value)}
              className="h-10 w-full text-xs rounded-xl border border-zinc-200 bg-white px-3 focus:outline-none"
            >
              <option value="DRAFTED">DRAFTED — Internal compensation review</option>
              <option value="EXTENDED">EXTENDED — Extended to candidate</option>
              <option value="ACCEPTED">ACCEPTED — Signed / Confirmed</option>
              <option value="DECLINED">DECLINED — Candidate declined</option>
              <option value="REVISED">REVISED — Counter-offer or revised package</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Base Salary</label>
              <Input
                type="number"
                value={offerSalary}
                onChange={(e) => setOfferSalary(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Currency</label>
              <Input
                value={offerCurrency}
                onChange={(e) => setOfferCurrency(e.target.value)}
                className="h-10 text-xs rounded-xl"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Equity Grant</label>
              <Input
                value={offerEquity}
                onChange={(e) => setOfferEquity(e.target.value)}
                placeholder="0.15% Options"
                className="h-10 text-xs rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-zinc-600">Sign-on Bonus</label>
              <Input
                type="number"
                value={offerSignOn}
                onChange={(e) => setOfferSignOn(e.target.value)}
                className="h-10 text-xs rounded-xl"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Target Start Date</label>
            <Input
              type="date"
              value={offerStartDate}
              onChange={(e) => setOfferStartDate(e.target.value)}
              className="h-10 text-xs rounded-xl"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-zinc-600">Offer Notes &amp; Terms</label>
            <textarea
              value={offerNotes}
              onChange={(e) => setOfferNotes(e.target.value)}
              placeholder="Approved by hiring executive, includes 4-year vesting schedule..."
              rows={3}
              className="w-full p-3 text-xs bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:border-zinc-400 leading-relaxed resize-none"
            />
          </div>

          <DialogFooter className="pt-4 flex justify-end gap-2 border-t border-zinc-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="text-xs rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="bg-black hover:bg-zinc-800 text-white text-xs px-5 rounded-xl transition-colors cursor-pointer"
            >
              {isSaving ? "Saving..." : "Save Offer Record"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
