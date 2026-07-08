'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

// --- VERİTABANI VE API AYARLARI ---
const DB_EPISODE_COLUMN = 'current_episode';
const DB_SEASON_COLUMN = 'current_season';

const supabaseUrl = 'https://spfgsomqrdexbphvlile.supabase.co';
const supabaseKey = 'sb_publishable_PGt2PZK22DOybLcNLHRpSA_Sd_0hDXJ';
const supabase = createClient(supabaseUrl, supabaseKey);

const TMDB_API_KEY = '8e8b5ada357ef6f33a40b19978fbfda3';
const ACCESS_PASSWORD = "hayatımınanlamı"; 

interface Show {
  id: number;
  title: string;
  poster_path: string;
  runtime?: number; 
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

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    setMounted(true);
    const authStatus = localStorage.getItem('tvtime_authenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
      verileriGetir();
    } else {
      setLoading(false);
    }
  }, []);

  const handlePasswordSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (passwordInput === ACCESS_PASSWORD) {
      localStorage.setItem('tvtime_authenticated', 'true');
      setIsAuthenticated(true);
      setPasswordError(false);
      verileriGetir();
    } else {
      setPasswordError(true);
      setPasswordInput('');
    }
  };

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

  // --- İŞLEM FONKSİYONLARI ---
  const bolumGuncelle = async (showId: number, currentEp: number, miktar: number) => {
    const yeniBolum = Math.max(0, currentEp + miktar);
    setAllData(prev => prev.map(item => item.show_id === showId ? { ...item, [DB_EPISODE_COLUMN]: yeniBolum } : item));
    await supabase.from('user_shows').update({ [DB_EPISODE_COLUMN]: yeniBolum }).eq('show_id', showId);
  };

  const sezonGuncelle = async (showId: number, currentSeas: number, miktar: number) => {
    const yeniSezon = Math.max(1, currentSeas + miktar);
    setAllData(prev => prev.map(item => item.show_id === showId ? { ...item, [DB_SEASON_COLUMN]: yeniSezon } : item));
    await supabase.from('user_shows').update({ [DB_SEASON_COLUMN]: yeniSezon }).eq('show_id', showId);
  };

  const durumDegistir = async (showId: number, currentStatus: string) => {
    const yeniDurum = currentStatus === 'continuing' ? 'up_to_date' : 'continuing';
    setAllData(prev => prev.map(item => item.show_id === showId ? { ...item, status: yeniDurum } : item));
    await supabase.from('user_shows').update({ status: yeniDurum }).eq('show_id', showId);
  };

  const diziyiSil = async (showId: number) => {
    if (!confirm('Bu diziyi listenden tamamen silmek istediğine emin misin?')) return;
    setAllData(prev => prev.filter(item => item.show_id !== showId));
    await supabase.from('user_shows').delete().eq('show_id', showId);
  };

  // --- TMDB ARAMA VE EKLEME ---
  const diziAra = async (query: string) => {
    if (!query.trim()) return setSearchResults([]);
    setSearchLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } finally {
      setSearchLoading(false);
    }
  };

  const listeyeEkle = async (tmdbShow: TMDBResult) => {
    try {
      // Dizinin ortalama bölüm süresini (runtime) al
      const detailRes = await fetch(`https://api.themoviedb.org/3/tv/${tmdbShow.id}?api_key=${TMDB_API_KEY}&language=tr-TR`);
      const detailData = await detailRes.json();
      const runtime = detailData.episode_run_time?.[0] || 45; 

      await supabase.from('shows').upsert({
        id: tmdbShow.id,
        title: tmdbShow.name,
        poster_path: tmdbShow.poster_path,
        runtime: runtime 
      }, { onConflict: 'id' });

      await supabase.from('user_shows').insert({
        show_id: tmdbShow.id,
        status: 'continuing',
        [DB_EPISODE_COLUMN]: 1,
        [DB_SEASON_COLUMN]: 1
      });

      alert(`${tmdbShow.name} eklendi!`);
      verileriGetir();
      setCurrentTab('continuing');
    } catch (err) {
      alert("Eklenirken hata oluştu.");
    }
  };

  // --- İSTATİSTİK HESAPLAMALARI ---
  const getEpisode = (item: UserShow) => Number(item[DB_EPISODE_COLUMN] || 0);
  const getSeason = (item: UserShow) => Number(item[DB_SEASON_COLUMN] || 0);
  const getShowInfo = (item: UserShow) => Array.isArray(item.shows) ? item.shows[0] : item.shows;

  const toplamBolum = allData.reduce((acc, item) => acc + getEpisode(item), 0);
  const toplamDizi = allData.length;
  const continuingCount = allData.filter(item => item.status === 'continuing').length;
  const upToDateCount = allData.filter(item => item.status === 'up_to_date').length;
  
  // Toplam dakikayı hesapla
  const toplamDakika = allData.reduce((acc, item) => {
    const show = getShowInfo(item);
    const runtime = show?.runtime || 45; 
    return acc + (getEpisode(item) * runtime);
  }, 0);

  // TV Time tarzı zaman kırılımı (Ay, Gün, Saat)
  const aylar = Math.floor(toplamDakika / (60 * 24 * 30));
  const kalanDakikaAydan = toplamDakika % (60 * 24 * 30);
  const gunler = Math.floor(kalanDakikaAydan / (60 * 24));
  const kalanDakikaGunden = kalanDakikaAydan % (60 * 24);
  const saatler = Math.floor(kalanDakikaGunden / 60);

  const filtrelenmisData = allData.filter(item => item.status === currentTab);

  if (!mounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col justify-center items-center px-4 font-sans selection:bg-[#e50914]">
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm bg-[#1a1a1a] border border-[#262626] rounded-2xl p-8 shadow-2xl text-center">
          <h2 className="text-[#f5c518] text-2xl font-black tracking-wider mb-2">MY TV TIME</h2>
          <div className="flex flex-col gap-3 mt-6">
            <input
              type="password"
              placeholder="Giriş Şifresi"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              className="w-full bg-[#262626] border border-[#3a3a3a] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[#f5c518] text-white transition-colors"
              autoFocus
            />
            <button type="submit" className="w-full py-3 bg-[#e50914] hover:bg-[#b80710] text-white font-bold text-sm rounded-xl transition-all shadow-md">
              Giriş Yap
            </button>
          </div>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#e0e0e0] font-sans pb-16 selection:bg-[#f5c518] selection:text-black">
      <header className="bg-[#1a1a1a]/80 backdrop-blur-md border-b border-[#262626] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-[#f5c518] text-xl font-black tracking-wider">MY TV TIME</h1>
          <span className="text-xs bg-[#262626] text-emerald-400 px-3 py-1.5 rounded-full border border-[#3a3a3a] font-medium shadow-sm">
            Veriler Devrede
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6">
        {/* GELİŞMİŞ İSTATİSTİK PANELİ */}
        <div className="bg-gradient-to-b from-[#1a1a1a] to-[#141414] border border-[#262626] rounded-2xl p-5 mb-8 shadow-lg">
          <p className="text-center text-xs text-gray-500 font-bold uppercase tracking-widest mb-4">TV Karşısında Geçirilen Zaman</p>
          <div className="grid grid-cols-3 gap-2 text-center mb-6">
            <div>
              <p className="text-3xl font-black text-[#f5c518]">{loading ? '-' : aylar}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Ay</p>
            </div>
            <div className="border-x border-[#262626]">
              <p className="text-3xl font-black text-white">{loading ? '-' : gunler}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Gün</p>
            </div>
            <div>
              <p className="text-3xl font-black text-emerald-400">{loading ? '-' : saatler}</p>
              <p className="text-[10px] text-gray-400 uppercase mt-1">Saat</p>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-2 text-center pt-4 border-t border-[#262626]">
            <div>
              <p className="text-lg font-bold text-white">{toplamBolum}</p>
              <p className="text-[10px] text-gray-500">İzlenen Bölüm</p>
            </div>
            <div>
              <p className="text-lg font-bold text-white">{toplamDizi}</p>
              <p className="text-[10px] text-gray-500">Toplam Dizi</p>
            </div>
            <div>
              <p className="text-lg font-bold text-[#4ade80]">{upToDateCount}</p>
              <p className="text-[10px] text-gray-500">Bitirilen Dizi</p>
            </div>
          </div>
        </div>

        <div className="flex gap-6 border-b border-[#262626] mb-6 text-sm font-medium">
          <button onClick={() => setCurrentTab('continuing')} className={`pb-3 transition-all ${currentTab === 'continuing' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}>
            İzliyorum ({continuingCount})
          </button>
          <button onClick={() => setCurrentTab('up_to_date')} className={`pb-3 transition-all ${currentTab === 'up_to_date' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}>
            Bitenler ({upToDateCount})
          </button>
          <button onClick={() => setCurrentTab('search')} className={`pb-3 transition-all ml-auto ${currentTab === 'search' ? 'text-[#4ade80] border-b-2 border-[#4ade80] font-bold' : 'text-gray-500 hover:text-gray-300'}`}>
            🔍 Dizi Ekle
          </button>
        </div>

        {currentTab === 'search' ? (
          <div className="flex flex-col gap-4">
            <div className="relative">
              <input
                type="text"
                placeholder="Dizi adı yazın ve enter'a basın..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && diziAra(searchQuery)}
                className="w-full bg-[#1a1a1a] border border-[#262626] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4ade80] text-white"
              />
              <button onClick={() => diziAra(searchQuery)} className="absolute right-3 top-2.5 bg-[#262626] hover:bg-[#3a3a3a] text-xs px-3 py-1.5 rounded-lg border border-[#3a3a3a] text-gray-300">Ara</button>
            </div>

            {searchLoading ? (
              <div className="text-center py-8 text-gray-500 text-sm">Aranıyor...</div>
            ) : searchResults.map((show) => (
              <div key={show.id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center justify-between">
                <div className="flex gap-3 items-center">
                  <img src={show.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Yok'} alt={show.name} className="w-12 h-18 object-cover rounded-md" />
                  <div>
                    <h4 className="text-white font-bold text-sm">{show.name}</h4>
                    <p className="text-xs text-gray-500">{show.first_air_date?.split('-')[0]}</p>
                  </div>
                </div>
                <button onClick={() => listeyeEkle(show)} className="px-3 py-1.5 bg-[#4ade80]/10 text-[#4ade80] font-bold text-xs rounded-lg border border-[#4ade80]/20">+ Ekle</button>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {filtrelenmisData.map((item) => {
              const show = getShowInfo(item);
              const d_title = show?.title || "Bilinmeyen Dizi";
              const imgUrl = show?.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Gorsel+Yok';

              return (
                <div key={item.show_id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center shadow-md">
                  <img src={imgUrl} alt={d_title} className="w-16 h-24 object-cover rounded-lg border border-[#262626]" />
                  
                  <div className="flex-1 py-1">
                    <h3 className="text-white font-bold text-base truncate mb-2">{d_title}</h3>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center bg-[#262626] rounded border border-[#3a3a3a]">
                        <button onClick={() => sezonGuncelle(item.show_id, getSeason(item), -1)} className="px-2 py-0.5 text-xs text-gray-400">-</button>
                        <span className="text-xs text-gray-200 font-bold">S{String(getSeason(item)).padStart(2, '0')}</span>
                        <button onClick={() => sezonGuncelle(item.show_id, getSeason(item), 1)} className="px-2 py-0.5 text-xs text-gray-400">+</button>
                      </div>
                      <div className="flex items-center bg-[#262626] rounded border border-[#3a3a3a]">
                        <button onClick={() => bolumGuncelle(item.show_id, getEpisode(item), -1)} className="px-2 py-0.5 text-xs text-gray-400">-</button>
                        <span className="px-2 text-sm text-[#f5c518] font-black">B{getEpisode(item)}</span>
                        <button onClick={() => bolumGuncelle(item.show_id, getEpisode(item), 1)} className="px-2 py-0.5 text-xs text-gray-400">+</button>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 flex-shrink-0 items-end">
                    <button
                      onClick={() => durumDegistir(item.show_id, item.status)}
                      className={`px-3 py-1 text-xs font-bold rounded-md border ${item.status === 'continuing' ? 'bg-[#f5c518]/10 text-[#f5c518] border-[#f5c518]/20' : 'bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20'}`}
                    >
                      {item.status === 'continuing' ? 'Bitir' : 'İzliyorum'}
                    </button>
                    <button onClick={() => diziyiSil(item.show_id)} className="px-3 py-1 text-xs font-bold rounded-md bg-red-500/10 text-red-500 border border-red-500/20">
                      Sil
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}