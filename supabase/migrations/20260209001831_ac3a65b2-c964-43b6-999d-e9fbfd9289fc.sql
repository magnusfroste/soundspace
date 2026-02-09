-- Add onboarding columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS business_subtype text,
ADD COLUMN IF NOT EXISTS atmospheres text[],
ADD COLUMN IF NOT EXISTS preferred_genres text[],
ADD COLUMN IF NOT EXISTS onboarding_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS suggested_playlist_ids uuid[];

-- Add index for faster lookup of onboarding status
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding_completed ON public.profiles(onboarding_completed);

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.business_subtype IS 'Sub-type of business, e.g., wine_bar, cocktail_bar';
COMMENT ON COLUMN public.profiles.atmospheres IS 'Array of selected atmosphere tags (max 3)';
COMMENT ON COLUMN public.profiles.preferred_genres IS 'Array of preferred music genres';
COMMENT ON COLUMN public.profiles.onboarding_completed IS 'Whether user has completed onboarding wizard';
COMMENT ON COLUMN public.profiles.suggested_playlist_ids IS 'AI-suggested playlist IDs for this profile';