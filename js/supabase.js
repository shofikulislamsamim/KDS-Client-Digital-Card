const SUPABASE_URL="https://xxsoybtxdqcdfkwgmktr.supabase.co";
const SUPABASE_KEY="sb_publishable_anyy_6KDjdreKItxKQBlbg_pAkCgKK_";
const supabaseClient=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
  auth:{autoRefreshToken:true,persistSession:true,detectSessionInUrl:true}
});