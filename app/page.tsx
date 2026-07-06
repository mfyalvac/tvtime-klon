'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- VERİTABANI AYARLARI ---
const DB_EPISODE_COLUMN = 'current_episode';
const DB_SEASON_COLUMN = 'current_season';

const supabaseUrl = 'https://spfgsomqrdexbphvlile.supabase.co';
const supabaseKey = 'sb_publishable_PGt2PZK22DOybLcNLHRpSA_Sd_0hDXJ';
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_API_KEY = '8e8b5ada357ef6f33a40b19978fbfda3';

// --- TİP TANIMLAMALARI ---
interface Show {
  id: number;
  title: string;
  poster_path: string;
}

interface UserShow {
  id: number;
  show_id: number;
  status: 'continuing' | 'up_to_date' | 'dropped';
  [key: string]: any;
  shows: Show | Show[];
}

interface TMDBResult {
  id: number;
  name: string;
  poster_path: string;
  first_air_date?: string;
}

export default function Dashboard() {
  const [currentTab, setCurrentTab] = useState<'continuing' | 'up_to_date' | 'search'>('continuing');
  const [allData, setAllData] = useState<UserShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Arama Eyaletleri (States)
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    verileriGetir();
  }, []);

  // Supabase'den Kullanıcı Dizilerini Çekme
  const verileriGetir = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('user_shows')
        .select(`*, shows (*)`);

      if (error) throw error;
      setAllData(data || []);
    } catch (err: any) {
      console.error('Supabase hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Bölüm Artırma (Optimistic UI)
  const bolumArtir = async (showId: number, currentEp: number) => {
    const yeniBolum = currentEp + 1;
    const previousData = [...allData];

    setAllData(prev =>
      prev.map(item => {
        const d_id = Array.isArray(item.shows) ? item.shows[0]?.id : item.shows?.id;
        if ((d_id || item.show_id) === showId) {
          return { ...item, [DB_EPISODE_COLUMN]: yeniBolum };
        }
        return item;
      })
    );

    try {
      const { error } = await supabase
        .from('user_shows')
        .update({ [DB_EPISODE_COLUMN]: yeniBolum })
        .eq('show_id', showId);

      if (error) throw error;
    } catch (error) {
      console.error("Güncelleme hatası:", error);
      setAllData(previousData);
    }
  };

  // TMDB API üzerinden Canlı Dizi Arama
  const diziAra = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR`
      );
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {
      console.error("TMDB arama hatası:", err);
    } finally {
      setSearchLoading(false);
    }
  };

  // Listeye Yeni Dizi Ekleme (Supabase)
  const listeyeEkle = async (tmdbShow: TMDBResult) => {
    try {
      // 1. Önce dizinin genel bilgilerini 'shows' tablosuna kaydet (Yoksa ekler)
      const { error: showErr } = await supabase
        .from('shows')
        .upsert({
          id: tmdbShow.id,
          title: tmdbShow.name,
          poster_path: tmdbShow.poster_path
        }, { onConflict: 'id' });

      if (showErr) throw showErr;

      // 2. Kullanıcının takibine ekle
      const { error: userShowErr } = await supabase
        .from('user_shows')
        .insert({
          show_id: tmdbShow.id,
          status: 'continuing',
          [DB_EPISODE_COLUMN]: 1,
          [DB_SEASON_COLUMN]: 1
        });

      if (userShowErr) throw userShowErr;

      alert(`${tmdbShow.name} başarıyla listene eklendi!`);
      verileriGetir(); // Listeyi yenile
      setCurrentTab('continuing'); // Ana sekmeye dön
    } catch (err: any) {
      console.error("Ekleme hatası:", err.message);
      alert("Dizi eklenirken bir hata oluştu.");
    }
  };

  // Yardımcı Veri Okuyucular
  const getEpisode = (item: UserShow) => Number(item[DB_EPISODE_COLUMN] || 0);
  const getSeason = (item: UserShow) => Number(item[DB_SEASON_COLUMN] || 0);
  const getShowInfo = (item: UserShow) => Array.isArray(item.shows) ? item.shows[0] : item.shows;

  // İstatistikler
  const toplamBolum = allData.reduce((acc, item) => acc + getEpisode(item), 0);
  const toplamSaat = Math.round((toplamBolum * 45) / 60);
  const toplamGun = (toplamSaat / 24).toFixed(1);

  const continuingCount = allData.filter(item => item.status === 'continuing').length;
  const upToDateCount = allData.filter(item => item.status === 'up_to_date').length;
  const filtrelenmisData = allData.filter(item => item.status === currentTab);

  if (!mounted) return null; // Hydration koruması

  return (
    <div className="min-h-screen bg-[#141414] text-[#e0e0e0] font-sans pb-16 selection:bg-[#f5c518] selection:text-black">
      {/* Header */}
      <header className="bg-[#1a1a1a]/80 backdrop-blur-md border-b border-[#262626] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-[#f5c518] text-xl font-black tracking-wider">MY TV TIME</h1>
          <span className="text-xs bg-[#262626] text-emerald-400 px-3 py-1.5 rounded-full border border-[#3a3a3a] font-medium flex items-center gap-1.5 shadow-sm">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            Sistem Hazır
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        
        {/* İstatistik Paneli */}
        <div className="grid grid-cols-3 gap-4 bg-gradient-to-b from-[#1a1a1a] to-[#141414] border border-[#262626] rounded-2xl p-5 mb-8 text-center shadow-lg">
          <div>
            <p className="text-3xl font-black text-[#f5c518]">{loading ? '...' : toplamBolum}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Bölüm</p>
          </div>
          <div className="border-x border-[#262626]">
            <p className="text-3xl font-black text-white">{loading ? '...' : toplamSaat}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Saat</p>
          </div>
          <div>
            <p className="text-3xl font-black text-emerald-400">{loading ? '...' : toplamGun}</p>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mt-1">Gün</p>
          </div>
        </div>

        {/* Tab Menü */}
        <div className="flex gap-6 border-b border-[#262626] mb-6 text-sm font-medium">
          <button
            onClick={() => setCurrentTab('continuing')}
            className={`pb-3 cursor-pointer transition-all ${currentTab === 'continuing' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}
          >
            İzliyorum ({continuingCount})
          </button>
          <button
            onClick={() => setCurrentTab('up_to_date')}
            className={`pb-3 cursor-pointer transition-all ${currentTab === 'up_to_date' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}
          >
            Bitenler ({upToDateCount})
          </button>
          <button
            onClick={() => setCurrentTab('search')}
            className={`pb-3 cursor-pointer transition-all ml-auto ${currentTab === 'search' ? 'text-[#4ade80] border-b-2 border-[#4ade80] font-bold' : 'text-gray-500 hover:text-gray-300'}`}
          >
            🔍 Dizi Ekle
          </button>
        </div>

        {/* --- 1. ARAMA SEKME İÇERİĞİ --- */}
        {currentTab === 'search' ? (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Dizi adı yazın ve enter'a basın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && diziAra(searchQuery)}
                className="w-full bg-[#1a1a1a] border border-[#262626] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4ade80] text-white transition-colors"
              />
              <button 
                onClick={() => diziAra(searchQuery)}
                className="absolute right-3 top-2.5 bg-[#262626] hover:bg-[#3a3a3a] text-xs px-3 py-1.5 rounded-lg border border-[#3a3a3a] text-gray-300"
              >
                Ara
              </button>
            </div>

            {searchLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">TMDB veritabanında aranıyor...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-12 bg-[#1a1a1a]/30 rounded-2xl border border-dashed border-[#262626] text-gray-500 text-sm">
                Keşfetmek için yukarıdan bir dizi aratın.
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-3">
                {searchResults.map((show) => (
                  <div key={show.id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center justify-between">
                    <div className="flex gap-3 items-center min-w-0">
                      <img 
                        src={show.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Yok'} 
                        alt={show.name} 
                        className="w-12 h-18 object-cover rounded-md bg-[#141414]"
                      />
                      <div className="min-w-0">
                        <h4 className="text-white font-bold text-sm truncate">{show.name}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{show.first_air_date ? show.first_air_date.split('-')[0] : 'Belirsiz'}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => listeyeEkle(show)}
                      className="px-3 py-1.5 bg-[#4ade80]/10 hover:bg-[#4ade80] text-[#4ade80] hover:text-black font-bold text-xs rounded-lg border border-[#4ade80]/20 transition-all active:scale-95"
                    >
                      + Takip Et
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- 2. LİSTE SEKME İÇERİĞİ (ESKİ KODUN) --- */
          loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-8 h-8 border-4 border-[#262626] border-t-[#f5c518] rounded-full animate-spin"></div>
              <span className="text-gray-500 text-sm">Arşiviniz Yükleniyor...</span>
            </div>
          ) : filtrelenmisData.length === 0 ? (
            <div className="text-center py-16 bg-[#1a1a1a]/50 rounded-2xl border border-dashed border-[#262626]">
              <p className="text-gray-400 text-sm">Bu listede henüz dizi yok.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {filtrelenmisData.map((item) => {
                const show = getShowInfo(item);
                const d_title = show?.title || "Bilinmeyen Dizi";
                const d_id = show?.id || item.show_id;
                const d_season = getSeason(item);
                const d_episode = getEpisode(item);
                
                const imgUrl = show?.poster_path 
                  ? `https://image.tmdb.org/t/p/w200${show.poster_path}` 
                  : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Gorsel+Yok';

                return (
                  <div key={item.id || d_id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center shadow-md hover:border-[#3a3a3a] transition-colors group">
                    <img src={imgUrl} alt={d_title} className="w-16 h-24 object-cover rounded-lg border border-[#262626] flex-shrink-0 bg-[#141414]" loading="lazy" />
                    
                    <div className="flex-1 min-w-0 py-1">
                      <h3 className="text-white font-bold text-base truncate mb-1.5 group-hover:text-[#f5c518] transition-colors">{d_title}</h3>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#262626] px-2 py-0.5 rounded text-xs text-gray-300 font-medium">
                          {d_season > 0 ? `S${String(d_season).padStart(2, '0')}` : 'S01'}
                        </span>
                        <span className="text-sm text-[#f5c518] font-bold">
                          Bölüm {d_episode}
                        </span>
                      </div>
                    </div>

                    <div className="flex-shrink-0 pr-1">
                      {item.status === 'continuing' ? (
                        <button
                          onClick={() => bolumArtir(d_id, d_episode)}
                          className="flex items-center gap-1.5 px-3 py-2 bg-[#262626] border border-[#3a3a3a] hover:bg-[#f5c518] hover:border-[#f5c518] hover:text-black rounded-lg text-white font-bold text-xs transition-all active:scale-95"
                        >
                          + Bölüm
                        </button>
                      ) : (
                        <span className="flex items-center gap-1 text-[#4ade80] text-xs font-bold bg-[#4ade80]/10 px-3 py-2 rounded-lg border border-[#4ade80]/20">
                          Bitti
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </main>
    </div>
  );
}