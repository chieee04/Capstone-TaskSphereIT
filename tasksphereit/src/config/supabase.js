import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://yycewdwuzrrxzthdnmpk.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl5Y2V3ZHd1enJyeHp0aGRubXBrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE2NzcwOTksImV4cCI6MjA3NzI1MzA5OX0.sWGnPEYfEBlSW5rA08J7BFAiP0kXfk-Ilqtw0nzxaQk";

export const supabase = createClient(supabaseUrl, supabaseKey);
