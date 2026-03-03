CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  artist_names text[] := ARRAY[
    'Adele', 'Beyoncé', 'Bowie', 'Cher', 'Drake', 'Elvis', 'Freddie',
    'Hendrix', 'Iggy', 'Janis', 'Kurt', 'Lennon', 'Madonna', 'Nina',
    'Otis', 'Prince', 'Rihanna', 'Sade', 'Thom', 'Usher',
    'Björk', 'Cardi', 'Dua', 'Erykah', 'Fela', 'Grimes',
    'Herbie', 'Imogen', 'Janelle', 'Kelis', 'Lauryn', 'Missy',
    'Norah', 'Pharrell', 'Questlove', 'Rosalía', 'Solange', 'Tash',
    'Vince', 'Willow', 'Yoko', 'Zappa', 'Abel', 'Billie',
    'Chet', 'Dolly', 'Etta', 'Frank', 'Gil', 'Hozier'
  ];
  random_name text;
BEGIN
  random_name := artist_names[1 + floor(random() * array_length(artist_names, 1))::int];
  INSERT INTO public.profiles (user_id, display_name) VALUES (NEW.id, random_name);
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'business');
  RETURN NEW;
END;
$function$;