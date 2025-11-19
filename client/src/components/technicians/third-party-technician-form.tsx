import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import React from "react";

export interface ThirdPartyFormData {
  contactName: string;
  phone: string;
  email: string;
  whatsappNumber: string;
  specialization: string;
  baseLocation: string;
  moneyAllowance: string;
}

interface ThirdPartyTechnicianFormProps {
  value: ThirdPartyFormData;
  onChange: (next: ThirdPartyFormData) => void;
}

export default function ThirdPartyTechnicianForm({ value, onChange }: ThirdPartyTechnicianFormProps) {
  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="contactName">Contact Person</Label>
        <Input
          id="contactName"
          value={value.contactName}
          onChange={(e) => onChange({ ...value, contactName: e.target.value })}
          placeholder="Jane Smith"
        />
      </div>
      <div>
        <Label htmlFor="phone">Phone</Label>
        <Input
          id="phone"
          value={value.phone}
          onChange={(e) => onChange({ ...value, phone: e.target.value })}
          placeholder="+1234567890"
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={value.email}
          onChange={(e) => onChange({ ...value, email: e.target.value })}
          placeholder="contact@acme.com"
        />
      </div>
      <div>
        <Label htmlFor="whatsappNumber">WhatsApp Number</Label>
        <Input
          id="whatsappNumber"
          value={value.whatsappNumber}
          onChange={(e) => onChange({ ...value, whatsappNumber: e.target.value })}
          placeholder="+1234567890"
        />
      </div>
      <div>
        <Label htmlFor="specialization">Specialization</Label>
        <Input
          id="specialization"
          value={value.specialization}
          onChange={(e) => onChange({ ...value, specialization: e.target.value })}
          placeholder="e.g., Refrigeration, General"
        />
      </div>
      <div>
        <Label htmlFor="baseLocation">Base Location</Label>
        <Input
          id="baseLocation"
          value={value.baseLocation}
          onChange={(e) => onChange({ ...value, baseLocation: e.target.value })}
          placeholder="City, State"
        />
      </div>
      <div>
        <Label htmlFor="moneyAllowance">Money Allowance (₹)</Label>
        <Input
          id="moneyAllowance"
          type="number"
          inputMode="decimal"
          step="0.01"
          min="0"
          value={value.moneyAllowance}
          onChange={(e) => onChange({ ...value, moneyAllowance: e.target.value })}
          placeholder="0.00"
        />
      </div>
    </div>
  );
}


