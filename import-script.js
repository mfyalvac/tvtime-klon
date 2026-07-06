const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// === ⚠️ BURAYI KENDİ TOPLADIĞIN ANAHTARLARLA DOLDUR ⚠️ ===
const TMDB_API_KEY = '8e8b5ada357ef6f33a40b19978fbfda3'; 
const SUPABASE_URL = 'https://spfgsomqrdexbphvlile.supabase.co';
const SUPABASE_KEY = '8e8b5ada357ef6f33a40b19978fbfda3';
// =======================================================

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function basla() {
  console.log('🚀 TV Time verileri okunuyor...');
  
  // HTML dosyasını düz metin olarak oku
  const htmlIcerik = fs.readFileSync('sadece_diziler_tvtime.html', 'utf8');
  
  // İçindeki var SHOWS = [...]; kısmını regex ile yakala
  const match = htmlIcerik.match(/var SHOWS\s*=\s*(\[\{[\s\S]*?\}\]);/);
  if (!match) {
    console.error('❌ HTML içinde SHOWS verisi bulunamadı!');
    return;
  }

  const tumDiziler = JSON.parse(match[1]);
  console.log(`📋 Toplam ${tumDiziler.length} dizi bulundu. Eşleştirme ve aktarım başlıyor...\n`);

  for (const dizi of tumDiziler) {
    // Hiç izlenmeyen dizileri şimdilik pas geçiyoruz (Watchlist'i sonra da hallederiz)
    if (dizi.watched === 0 && dizi.status === 'not_started_yet') {
      console.log(`⏩ ${dizi.title} hiç izlenmemiş, atlanıyor.`);
      continue;
    }

    try {
      console.log(`🔎 TMDB'de aranıyor: ${dizi.title} (TVDB ID: ${dizi.tvdbId})`);
      
      // TVDB ID'yi kullanarak TMDB'den orijinal dizi kimliğini buluyoruz
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/find/${dizi.tvdbId}?api_key=${TMDB_API_KEY}&external_source=tvdb_id`
      );
      const tmdbData = await tmdbRes.json();

      if (tmdbData.tv_results && tmdbData.tv_results.length > 0) {
        const tmdbShow = tmdbData.tv_results[0];
        const tmdbId = tmdbShow.id;

        console.log(`✅ Eşleşti -> TMDB ID: ${tmdbId}`);

        // 1. Ortak dizi havuzuna (shows) ekle/güncelle
        const { error: showErr } = await supabase
          .from('shows')
          .upsert({ 
            id: tmdbId, 
            title: dizi.title, 
            poster_path: tmdbShow.poster_path
          });

        if (showErr) throw showErr;

        // 2. Kullanıcıya özel listeye (user_shows) durumunu ekle
        const { error: userShowErr } = await supabase
          .from('user_shows')
          .upsert({
            show_id: tmdbId,
            status: dizi.status
          });

        if (userShowErr) throw userShowErr;

        console.log(`💾 ${dizi.title} bulut veritabanına aktarıldı.\n`);

      } else {
        console.log(`⚠️ ${dizi.title} için TMDB karşılığı bulunamadı.\n`);
      }
    } catch (err) {
      console.error(`💥 Hata (${dizi.title}):`, err.message);
    }
    
    // TMDB API'sini yormamak için kısa bir bekleme (250ms)
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  console.log('🏁 Tüm aktarım süreci başarıyla tamamlandı!');
}

basla();