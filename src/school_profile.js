(function(){
  const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
  window.schoolProfile = {
    async name(){ return String(await api.getSetting('school_name', '') || '').trim(); },
    gradeCount: type => type === '초등학교' ? 6 : 3,
    async periods(records=[]){
      const configured = Math.min(12, Math.max(1, Math.trunc(Number(await api.getSetting('period_count', '7'))) || 7));
      // 설정을 줄여도 이미 입력한 뒤쪽 교시는 숨기거나 지우지 않는다.
      return records.reduce((max, row) => Number.isInteger(row.period) && row.period <= 12 ? Math.max(max, row.period) : max, configured);
    },
    async load(){
      const settings = await api.getAllSettings();
      const parsed = parse(settings.school_profile);
      const profile = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
      if (settings.class_year !== undefined || settings.class_num !== undefined) {
        profile.homeroom = settings.class_year && settings.class_num ? `${settings.class_year}학년 ${settings.class_num}반` : '';
      }
      return profile;
    },
    async classes(records=[]){
      const profile=await this.load();
      return [...new Set([...(profile.classes||[]), profile.homeroom, ...records.map(row=>row.class_group)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
    }
  };
})();
