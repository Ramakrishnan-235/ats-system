"use client";
import Link from "next/link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
export function AddCandidateModal({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent><DialogHeader><DialogTitle>Add a candidate</DialogTitle><DialogDescription>Upload a resume to create a backend candidate record, then assign it to a job from the candidate repository.</DialogDescription></DialogHeader><Button asChild><Link href="/upload">Upload resume</Link></Button></DialogContent></Dialog>;
}
