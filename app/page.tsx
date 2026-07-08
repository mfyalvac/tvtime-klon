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
const ACCESS_PASSWORD = "hayatımınanlamı"; 

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

interface TMDBEpisode {
  id: number;
  episode_number: number;
  name: string;
  overview: string;
  still_path: string;
  air_date: string;
  runtime?: number; // DAKİKA ÖZELLİĞİ EKLENDİ
}

export default function Dashboard() {
  const [currentTab, setCurrentTab] = useState<'continuing' | 'up_to_date' | 'search'>('continuing');
  const [allData, setAllData] = useState<UserShow[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  // Güvenlik State'leri
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState(false);

  // Arama State'leri
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TMDBResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [activeMenuId, setActiveMenuId] = useState<number | null>(null);

  // --- DETAY SAYFASI STATE'LERİ ---
  const [selectedShow, setSelectedShow] = useState<any>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [seasonDetails, setSeasonDetails] = useState<any>(null);
  const [detailLoading, setDetailLoading] = useState(false);

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
        .select(`*, shows (*)`)
        .order('id', { ascending: false });

      if (error) throw error;
      setAllData(data || []);
    } catch (err: any) {
      console.error('Supabase hatası:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // --- DETAY GÖSTERİM FONKSİYONLARI ---
  const handleShowClick = async (showId: number, currentSeason: number) => {
    setDetailLoading(true);
    setSelectedShow(null);
    setSeasonDetails(null);
    
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&language=tr-TR`);
      const showData = await res.json();
      setSelectedShow(showData);
      
      const targetSeason = currentSeason > 0 ? currentSeason : 1;
      setSelectedSeason(targetSeason);
      await fetchSeasonDetails(showId, targetSeason);
      
    } catch (error) {
      console.error("Detay getirme hatası:", error);
    } finally {
      setDetailLoading(false);
    }
  };

  const fetchSeasonDetails = async (showId: number, seasonNumber: number) => {
    setSeasonDetails(null);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}&language=tr-TR`);
      const data = await res.json();
      setSeasonDetails(data);
    } catch (error) {
      console.error("Sezon getirme hatası:", error);
    }
  };

  const handleSeasonChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const s = Number(e.target.value);
    setSelectedSeason(s);
    if (selectedShow) {
      fetchSeasonDetails(selectedShow.id, s);
    }
  };

  // --- DİĞER FONKSİYONLAR ---
  const bolumArtir = async (e: React.MouseEvent, showId: number, currentEp: number) => {
    e.stopPropagation(); 
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
      const { error } = await supabase.from('user_shows').update({ [DB_EPISODE_COLUMN]: yeniBolum }).eq('show_id', showId);
      if (error) throw error;
    } catch (error) {
      setAllData(previousData);
    }
  };

  const diziyiBitir = async (e: React.MouseEvent, showId: number) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/tv/${showId}?api_key=${TMDB_API_KEY}&language=tr-TR`);
      const tmdbData = await res.json();
      const toplamBolum = tmdbData.number_of_episodes || 0;
      const toplamSezon = tmdbData.number_of_seasons || 1;

      const { error } = await supabase.from('user_shows').update({ 
          status: 'up_to_date', [DB_EPISODE_COLUMN]: toplamBolum, [DB_SEASON_COLUMN]: toplamSezon 
        }).eq('show_id', showId);

      if (error) throw error;
      setAllData(prev => prev.map(item => item.show_id === showId ? { ...item, status: 'up_to_date', [DB_EPISODE_COLUMN]: toplamBolum, [DB_SEASON_COLUMN]: toplamSezon } : item));
    } catch (error) {}
  };

  const diziyiGeriAl = async (e: React.MouseEvent, showId: number) => {
    e.stopPropagation();
    setActiveMenuId(null);
    try {
      const { error } = await supabase.from('user_shows').update({ status: 'continuing' }).eq('show_id', showId);
      if (error) throw error;
      setAllData(prev => prev.map(item => item.show_id === showId ? { ...item, status: 'continuing' } : item));
    } catch (error) {}
  };

  const diziyiSil = async (e: React.MouseEvent, showId: number) => {
    e.stopPropagation();
    const onay = window.confirm("Bu diziyi tamamen silmek istediğine emin misin?");
    if (!onay) return;
    setActiveMenuId(null);
    try {
      const { error } = await supabase.from('user_shows').delete().eq('show_id', showId);
      if (error) throw error;
      setAllData(prev => prev.filter(item => item.show_id !== showId));
    } catch (error) {}
  };

  const diziAra = async (query: string) => {
    if (!query.trim()) { setSearchResults([]); return; }
    setSearchLoading(true);
    try {
      const res = await fetch(`https://api.themoviedb.org/3/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&language=tr-TR`);
      const data = await res.json();
      setSearchResults(data.results || []);
    } catch (err) {} finally { setSearchLoading(false); }
  };

  // --- DİZİ EKLEME MANTIĞI DÜZELTİLDİ ---
  const listeyeEkle = async (tmdbShow: TMDBResult) => {
    const zatenEkli = allData.some(item => item.show_id === tmdbShow.id);
    if (zatenEkli) { alert("Bu dizi zaten listende var!"); return; }

    // Hızlı yansıtma (Optimistic UI) - Ekranda bekleme yapmadan anında göster
    const newTempShow: any = {
      id: Date.now(),
      show_id: tmdbShow.id,
      status: 'continuing',
      [DB_EPISODE_COLUMN]: 0,
      [DB_SEASON_COLUMN]: 1,
      shows: {
        id: tmdbShow.id,
        title: tmdbShow.name,
        poster_path: tmdbShow.poster_path
      }
    };
    setAllData(prev => [newTempShow, ...prev]);
    
    // Aramayı temizle ve "İzliyorum" sekmesine at
    setSearchQuery('');
    setSearchResults([]);
    setCurrentTab('continuing');

    try {
      await supabase.from('shows').upsert({ id: tmdbShow.id, title: tmdbShow.name, poster_path: tmdbShow.poster_path }, { onConflict: 'id' });
      await supabase.from('user_shows').insert({ show_id: tmdbShow.id, status: 'continuing', [DB_EPISODE_COLUMN]: 0, [DB_SEASON_COLUMN]: 1 });
      
      // Arka planda verileri güvenli şekilde güncelle
      await verileriGetir();
    } catch (err: any) { alert("Dizi eklenirken hata oluştu."); }
  };

  const getEpisode = (item: UserShow) => Number(item[DB_EPISODE_COLUMN] || 0);
  const getSeason = (item: UserShow) => Number(item[DB_SEASON_COLUMN] || 0);
  const getShowInfo = (item: UserShow) => Array.isArray(item.shows) ? item.shows[0] : item.shows;

  const toplamBolum = allData.reduce((acc, item) => acc + getEpisode(item), 0);
  const toplamSaat = Math.round((toplamBolum * 45) / 60);
  const toplamGun = (toplamSaat / 24).toFixed(1);
  const continuingCount = allData.filter(item => item.status === 'continuing').length;
  const upToDateCount = allData.filter(item => item.status === 'up_to_date').length;
  const filtrelenmisData = allData.filter(item => item.status === currentTab);

  if (!mounted) return null;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#141414] text-white flex flex-col justify-center items-center px-4 font-sans">
        <form onSubmit={handlePasswordSubmit} className="w-full max-w-sm bg-[#1a1a1a] border border-[#262626] rounded-2xl p-8 text-center shadow-2xl">
          <h2 className="text-[#f5c518] text-2xl font-black tracking-wider mb-2">MY TV TIME</h2>
          <p className="text-gray-400 text-xs uppercase tracking-widest font-bold mb-6">Özel Alan 🎬</p>
          <div className="flex flex-col gap-3">
            <input type="password" placeholder="Giriş Şifresi" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-[#262626] border border-[#3a3a3a] rounded-xl px-4 py-3 text-sm text-center focus:outline-none focus:border-[#f5c518] text-white" autoFocus />
            <button type="submit" className="w-full py-3 bg-[#e50914] hover:bg-[#b80710] text-white font-bold text-sm rounded-xl">Giriş Yap</button>
          </div>
          {passwordError && <p className="text-red-500 text-xs font-bold mt-4 animate-pulse">Hatalı şifre! 🍿</p>}
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#141414] text-[#e0e0e0] font-sans pb-16 selection:bg-[#f5c518] selection:text-black">
      <header className="bg-[#1a1a1a]/80 backdrop-blur-md border-b border-[#262626] sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-[#f5c518] text-xl font-black tracking-wider cursor-pointer" onClick={() => { setSelectedShow(null); setCurrentTab('continuing'); }}>MY TV TIME</h1>
          <span className="text-xs bg-[#262626] text-emerald-400 px-3 py-1.5 rounded-full border border-[#3a3a3a] font-medium flex items-center gap-1.5 shadow-sm">
            <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
            Sistem Hazır
          </span>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 relative">
        
        {detailLoading && (
          <div className="absolute inset-0 bg-[#141414] z-10 flex flex-col items-center justify-center pt-20 gap-3 min-h-[500px]">
             <div className="w-8 h-8 border-4 border-[#262626] border-t-[#f5c518] rounded-full animate-spin"></div>
             <span className="text-gray-500 text-sm">Dizi Detayları Çekiliyor...</span>
          </div>
        )}

        {/* --- DETAY SAYFASI --- */}
        {!detailLoading && selectedShow ? (
          <div className="animate-fade-in pb-10">
            <button 
              onClick={() => { setSelectedShow(null); setSeasonDetails(null); }}
              className="mb-4 flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm font-bold bg-[#1a1a1a] px-4 py-2 rounded-lg border border-[#262626]"
            >
              ⬅ Geri Dön
            </button>
            
            <div className="relative w-full h-48 md:h-64 rounded-2xl overflow-hidden mb-6 border border-[#262626]">
              <img 
                src={selectedShow.backdrop_path ? `https://image.tmdb.org/t/p/w780${selectedShow.backdrop_path}` : `https://image.tmdb.org/t/p/w500${selectedShow.poster_path}`} 
                className="w-full h-full object-cover opacity-60" 
                alt={selectedShow.name} 
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#141414] via-[#141414]/50 to-transparent"></div>
              <div className="absolute bottom-4 left-4 right-4">
                <h2 className="text-3xl font-black text-white drop-shadow-md">{selectedShow.name}</h2>
                <div className="flex flex-wrap gap-2 items-center mt-2 text-xs font-bold">
                  <span className="text-[#f5c518]">⭐ {Number(selectedShow.vote_average).toFixed(1)}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{selectedShow.first_air_date?.split('-')[0]}</span>
                  <span className="text-gray-400">•</span>
                  <span className="text-gray-300">{selectedShow.number_of_seasons} Sezon</span>
                  
                  {/* ORTALAMA BÖLÜM SÜRESİ EKLENDİ */}
                  {(selectedShow.episode_run_time?.[0] || selectedShow.last_episode_to_air?.runtime) > 0 && (
                    <>
                      <span className="text-gray-400">•</span>
                      <span className="text-gray-300 bg-[#262626] px-2 py-0.5 rounded-md border border-[#3a3a3a]">
                        ~{selectedShow.episode_run_time?.[0] || selectedShow.last_episode_to_air?.runtime} dk
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>

            <p className="text-gray-400 text-sm leading-relaxed mb-6 bg-[#1a1a1a] p-4 rounded-xl border border-[#262626]">
              {selectedShow.overview || "Bu dizi için henüz bir özet bulunmuyor."}
            </p>

            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-white">Bölümler</h3>
              <select 
                value={selectedSeason} 
                onChange={handleSeasonChange}
                className="bg-[#262626] border border-[#3a3a3a] text-white text-sm rounded-lg px-3 py-2 outline-none focus:border-[#f5c518]"
              >
                {selectedShow.seasons?.filter((s: any) => s.season_number > 0).map((season: any) => (
                  <option key={season.id} value={season.season_number}>
                    {season.name} ({season.episode_count} Bölüm)
                  </option>
                ))}
              </select>
            </div>

            {!seasonDetails ? (
              <div className="text-center py-10 text-gray-500 text-sm">Bölümler Yükleniyor...</div>
            ) : (
              <div className="flex flex-col gap-3">
                {seasonDetails.episodes?.map((ep: TMDBEpisode) => (
                  <div key={ep.id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 hover:border-[#3a3a3a] transition-colors">
                    <img 
                      src={ep.still_path ? `https://image.tmdb.org/t/p/w300${ep.still_path}` : 'https://via.placeholder.com/300x170/1a1a1a/666666?text=Yok'} 
                      alt={ep.name} 
                      className="w-28 h-16 object-cover rounded-lg border border-[#262626] bg-[#141414] flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white font-bold text-sm truncate">{ep.episode_number}. {ep.name}</h4>
                      <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                        {ep.overview || "Özet bulunmuyor."}
                      </p>
                      <span className="text-[10px] text-gray-600 block mt-1 font-medium">
                        {ep.air_date ? ep.air_date.split('-').reverse().join('.') : 'Bilinmeyen Tarih'}
                        {/* HER BÖLÜMÜN KENDİ SÜRESİ EKLENDİ */}
                        {ep.runtime ? ` • ⏳ ${ep.runtime} dk` : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* --- ANA LİSTE --- */
          <div className={detailLoading ? "hidden" : "block"}>
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

            <div className="flex gap-6 border-b border-[#262626] mb-6 text-sm font-medium">
              <button onClick={() => setCurrentTab('continuing')} className={`pb-3 cursor-pointer transition-all ${currentTab === 'continuing' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}>İzliyorum ({continuingCount})</button>
              <button onClick={() => setCurrentTab('up_to_date')} className={`pb-3 cursor-pointer transition-all ${currentTab === 'up_to_date' ? 'text-[#f5c518] border-b-2 border-[#f5c518] font-bold' : 'text-gray-500'}`}>Bitenler ({upToDateCount})</button>
              <button onClick={() => setCurrentTab('search')} className={`pb-3 cursor-pointer transition-all ml-auto ${currentTab === 'search' ? 'text-[#4ade80] border-b-2 border-[#4ade80] font-bold' : 'text-gray-500 hover:text-gray-300'}`}>🔍 Dizi Ekle</button>
            </div>

            {currentTab === 'search' ? (
              <div className="flex flex-col gap-4 animate-fade-in">
                <div className="relative">
                  <input type="text" placeholder="Dizi adı yazın ve enter'a basın..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && diziAra(searchQuery)} className="w-full bg-[#1a1a1a] border border-[#262626] rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-[#4ade80] text-white transition-colors" autoFocus />
                  <button onClick={() => diziAra(searchQuery)} className="absolute right-3 top-2.5 bg-[#262626] hover:bg-[#3a3a3a] text-xs px-3 py-1.5 rounded-lg border border-[#3a3a3a] text-gray-300">Ara</button>
                </div>
                {searchLoading ? <div className="text-center py-8 text-gray-500 text-sm">Aranıyor...</div> : searchResults.length === 0 ? <div className="text-center py-12 bg-[#1a1a1a]/30 rounded-2xl border border-dashed border-[#262626] text-gray-500 text-sm">Keşfetmek için bir dizi aratın.</div> : (
                  <div className="grid grid-cols-1 gap-3">
                    {searchResults.map((show) => (
                      <div key={show.id} className="bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center justify-between hover:border-[#3a3a3a] transition-colors">
                        <div className="flex gap-3 items-center min-w-0">
                          <img src={show.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Yok'} alt={show.name} className="w-12 h-18 object-cover rounded-md bg-[#141414]" />
                          <div className="min-w-0">
                            <h4 className="text-white font-bold text-sm truncate">{show.name}</h4>
                            <p className="text-xs text-gray-500 mt-0.5">{show.first_air_date ? show.first_air_date.split('-')[0] : 'Belirsiz'}</p>
                          </div>
                        </div>
                        <button onClick={() => listeyeEkle(show)} className="px-3 py-1.5 bg-[#4ade80]/10 hover:bg-[#4ade80] text-[#4ade80] hover:text-black font-bold text-xs rounded-lg border border-[#4ade80]/20 transition-all active:scale-95 whitespace-nowrap">+ Ekle</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              loading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-3"><div className="w-8 h-8 border-4 border-[#262626] border-t-[#f5c518] rounded-full animate-spin"></div><span className="text-gray-500 text-sm">Arşiviniz Yükleniyor...</span></div>
              ) : filtrelenmisData.length === 0 ? (
                <div className="text-center py-16 bg-[#1a1a1a]/50 rounded-2xl border border-dashed border-[#262626]"><p className="text-gray-400 text-sm">Bu listede henüz dizi yok.</p></div>
              ) : (
                <div className="flex flex-col gap-4">
                  {filtrelenmisData.map((item) => {
                    const show = getShowInfo(item);
                    const d_title = show?.title || "Bilinmeyen Dizi";
                    const d_id = show?.id || item.show_id;
                    const d_season = getSeason(item);
                    const d_episode = getEpisode(item);
                    const imgUrl = show?.poster_path ? `https://image.tmdb.org/t/p/w200${show.poster_path}` : 'https://via.placeholder.com/200x300/1a1a1a/666666?text=Gorsel+Yok';
                    const isMenuOpen = activeMenuId === d_id;

                    return (
                      <div 
                        key={item.id || d_id} 
                        onClick={() => handleShowClick(d_id, d_season)}
                        className="relative bg-[#1a1a1a] border border-[#262626] rounded-xl p-3 flex gap-4 items-center shadow-md hover:border-[#3a3a3a] transition-colors group cursor-pointer animate-fade-in"
                      >
                        <img src={imgUrl} alt={d_title} className="w-16 h-24 object-cover rounded-lg border border-[#262626] flex-shrink-0 bg-[#141414]" loading="lazy" />
                        
                        <div className="flex-1 min-w-0 py-1">
                          <h3 className="text-white font-bold text-base truncate mb-1.5 group-hover:text-[#f5c518] transition-colors">{d_title}</h3>
                          <div className="flex items-center gap-2">
                            {item.status === 'continuing' ? (
                              <><span className="bg-[#262626] px-2 py-0.5 rounded text-xs text-gray-300 font-medium">S{String(d_season).padStart(2, '0')}</span><span className="text-sm text-[#f5c518] font-bold">Bölüm {d_episode}</span></>
                            ) : (
                              <span className="text-sm text-[#4ade80] font-bold">Tamamlandı ({d_episode} Bölüm)</span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col gap-2 items-end flex-shrink-0 pr-1">
                          {item.status === 'continuing' ? (
                            <button onClick={(e) => bolumArtir(e, d_id, d_episode)} className="px-4 py-2 bg-[#262626] border border-[#3a3a3a] hover:bg-[#f5c518] hover:border-[#f5c518] hover:text-black rounded-lg text-white font-bold text-xs transition-all active:scale-95">+ BÖLÜM</button>
                          ) : (
                            <span className="flex items-center gap-1 text-[#4ade80] text-xs font-bold bg-[#4ade80]/10 px-3 py-2 rounded-lg border border-[#4ade80]/20">Bitti</span>
                          )}
                          
                          <button onClick={(e) => { e.stopPropagation(); setActiveMenuId(isMenuOpen ? null : d_id); }} className="text-gray-500 hover:text-white text-xs px-2 py-1 bg-[#262626] rounded border border-[#3a3a3a] transition-colors">⚙️ Ayarlar</button>
                        </div>

                        {isMenuOpen && (
                          <div className="absolute right-4 top-14 bg-[#262626] border border-[#3a3a3a] rounded-lg shadow-2xl p-2 flex flex-col gap-1 z-10 min-w-[120px] animate-fade-in" onClick={(e) => e.stopPropagation()}>
                            {item.status === 'continuing' ? (
                              <button onClick={(e) => diziyiBitir(e, d_id)} className="text-left px-3 py-2 text-xs font-bold text-[#4ade80] hover:bg-[#3a3a3a] rounded transition-colors">✅ Bitirdim</button>
                            ) : (
                              <button onClick={(e) => diziyiGeriAl(e, d_id)} className="text-left px-3 py-2 text-xs font-bold text-white hover:bg-[#3a3a3a] rounded transition-colors">↩️ Geri Al</button>
                            )}
                            <button onClick={(e) => diziyiSil(e, d_id)} className="text-left px-3 py-2 text-xs font-bold text-red-400 hover:bg-[#3a3a3a] rounded transition-colors">🗑️ Diziyi Sil</button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}
      </main>
    </div>
  );
}