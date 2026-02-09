import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const BUSINESS_TYPES = [
  { value: "bar", label: "Bar" },
  { value: "cafe", label: "Cafe" },
  { value: "restaurant", label: "Restaurant" },
  { value: "gym", label: "Gym" },
  { value: "hotel", label: "Hotel" },
  { value: "office", label: "Office" },
  { value: "salon", label: "Salon" },
  { value: "spa", label: "Spa" },
  { value: "store", label: "Store" },
  { value: "medical", label: "Medical" },
  { value: "other", label: "Other" },
] as const;

const SUBTYPES: Record<string, { value: string; label: string }[]> = {
  bar: [
    { value: "wine_bar", label: "Wine Bar" },
    { value: "cocktail_bar", label: "Cocktail Bar" },
    { value: "pub", label: "Pub" },
    { value: "dive_bar", label: "Dive Bar" },
    { value: "sports_bar", label: "Sports Bar" },
    { value: "lounge", label: "Lounge" },
  ],
  cafe: [
    { value: "coffee_shop", label: "Coffee Shop" },
    { value: "bakery_cafe", label: "Bakery Cafe" },
    { value: "brunch_spot", label: "Brunch Spot" },
    { value: "tea_house", label: "Tea House" },
  ],
  restaurant: [
    { value: "fine_dining", label: "Fine Dining" },
    { value: "casual_dining", label: "Casual Dining" },
    { value: "fast_casual", label: "Fast Casual" },
    { value: "bistro", label: "Bistro" },
    { value: "pizzeria", label: "Pizzeria" },
  ],
  gym: [
    { value: "fitness_center", label: "Fitness Center" },
    { value: "yoga_studio", label: "Yoga Studio" },
    { value: "crossfit", label: "CrossFit" },
    { value: "boxing_gym", label: "Boxing Gym" },
  ],
  hotel: [
    { value: "boutique_hotel", label: "Boutique Hotel" },
    { value: "business_hotel", label: "Business Hotel" },
    { value: "resort", label: "Resort" },
    { value: "hostel", label: "Hostel" },
  ],
  office: [
    { value: "corporate", label: "Corporate" },
    { value: "coworking", label: "Coworking" },
    { value: "startup", label: "Startup" },
    { value: "creative_agency", label: "Creative Agency" },
  ],
  salon: [
    { value: "hair_salon", label: "Hair Salon" },
    { value: "nail_salon", label: "Nail Salon" },
    { value: "barber_shop", label: "Barber Shop" },
    { value: "beauty_salon", label: "Beauty Salon" },
  ],
  spa: [
    { value: "day_spa", label: "Day Spa" },
    { value: "wellness_center", label: "Wellness Center" },
    { value: "massage_studio", label: "Massage Studio" },
  ],
  store: [
    { value: "boutique", label: "Boutique" },
    { value: "clothing_store", label: "Clothing Store" },
    { value: "electronics", label: "Electronics" },
    { value: "grocery", label: "Grocery" },
    { value: "bookstore", label: "Bookstore" },
  ],
  medical: [
    { value: "dental_clinic", label: "Dental Clinic" },
    { value: "doctors_office", label: "Doctor's Office" },
    { value: "therapy_center", label: "Therapy Center" },
    { value: "pharmacy", label: "Pharmacy" },
  ],
  other: [
    { value: "gallery", label: "Gallery" },
    { value: "event_space", label: "Event Space" },
    { value: "waiting_room", label: "Waiting Room" },
  ],
};

interface BusinessTypeStepProps {
  businessType: string;
  businessSubtype: string;
  onBusinessTypeChange: (value: string) => void;
  onBusinessSubtypeChange: (value: string) => void;
  onNext: () => void;
}

export function BusinessTypeStep({
  businessType,
  businessSubtype,
  onBusinessTypeChange,
  onBusinessSubtypeChange,
  onNext,
}: BusinessTypeStepProps) {
  const subtypes = businessType ? SUBTYPES[businessType] || [] : [];

  const handleTypeChange = (value: string) => {
    onBusinessTypeChange(value);
    onBusinessSubtypeChange(""); // Reset subtype when type changes
  };

  const canContinue = businessType && (subtypes.length === 0 || businessSubtype);

  return (
    <div className="space-y-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-semibold">What type of business do you run?</h2>
        <p className="text-muted-foreground">
          This helps us find the perfect music for your space
        </p>
      </div>

      <div className="space-y-6 max-w-md mx-auto">
        <div className="space-y-2">
          <Label htmlFor="business-type">Business Category</Label>
          <Select value={businessType} onValueChange={handleTypeChange}>
            <SelectTrigger id="business-type" className="w-full">
              <SelectValue placeholder="Select your business type" />
            </SelectTrigger>
            <SelectContent>
              {BUSINESS_TYPES.map((type) => (
                <SelectItem key={type.value} value={type.value}>
                  {type.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {subtypes.length > 0 && (
          <div className="space-y-3">
            <Label>What kind of {BUSINESS_TYPES.find(t => t.value === businessType)?.label.toLowerCase()}?</Label>
            <div className="flex flex-wrap gap-2">
              {subtypes.map((subtype) => (
                <button
                  key={subtype.value}
                  type="button"
                  onClick={() => onBusinessSubtypeChange(subtype.value)}
                  className={cn(
                    "px-4 py-2 rounded-full text-sm font-medium transition-all",
                    "border hover:border-primary/50",
                    businessSubtype === subtype.value
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-background border-border hover:bg-accent"
                  )}
                >
                  {subtype.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex justify-center pt-4">
        <Button
          size="lg"
          onClick={onNext}
          disabled={!canContinue}
          className="min-w-[200px]"
        >
          Continue
        </Button>
      </div>
    </div>
  );
}
