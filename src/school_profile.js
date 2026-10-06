(function(){
  const parse = value => { try { return JSON.parse(value || '{}'); } catch { return {}; } };
  window.schoolProfile = {
    gradeCount: type => type === '초등학교' ? 6 : 3,
    async load(){ return parse(await api.getSetting('school_profile','')); },
    async classes(records=[]){
      const profile=await this.load();
      return [...new Set([...(profile.classes||[]), ...records.map(row=>row.class_group)].filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ko',{numeric:true}));
    }
  };
})();
