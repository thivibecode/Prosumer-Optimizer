import React, { useState, useEffect, useMemo } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ComposedChart, ScatterChart, Scatter, ZAxis } from 'recharts';

// ============================================================
// ============================================================
// BDEW H0 STUNDENPROFILE (Industriestandard)
// 9 Profile: 3 Saisons × 3 Tagestypen (Werktag/Samstag/Sonntag)
// Werte sind die offiziellen BDEW H0 Repraesentativwerte
// Quelle: BDEW Standardlastprofile Strom 2000, dynamisiert nach Formel
// ============================================================

const BDEW_H0 = {
  winter: {
    werktag:  [70.4,66.0,63.4,62.1,62.5,67.2,77.7,90.6,99.4,100.6,99.0,98.3,95.7,93.8,93.2,94.6,99.4,109.6,116.2,113.0,108.7,103.0,93.4,80.2],
    samstag:  [73.7,69.0,66.0,63.6,63.4,65.6,71.4,80.0,90.4,98.3,103.0,103.6,101.5,98.6,95.5,94.2,97.3,107.7,116.4,116.4,113.4,108.5,99.7,87.3],
    sonntag:  [69.7,65.4,62.6,60.7,60.6,62.4,67.3,75.0,84.1,93.0,100.0,103.7,103.0,99.1,94.0,91.0,93.5,103.7,113.6,114.7,111.8,107.0,98.7,86.7],
  },
  sommer: {
    werktag:  [60.0,55.6,52.7,51.3,51.7,55.2,62.6,73.0,81.0,84.0,83.6,83.7,82.5,81.5,80.7,80.3,82.0,87.0,89.3,87.5,84.7,80.8,73.7,63.0],
    samstag:  [62.4,58.0,54.7,52.6,52.0,53.4,57.7,64.6,73.0,79.6,84.1,86.0,86.0,84.5,82.0,80.0,80.7,84.5,87.4,86.4,84.0,81.0,75.4,65.6],
    sonntag:  [58.7,54.4,51.7,49.7,49.4,50.4,53.7,59.5,66.7,74.0,80.5,84.6,86.4,85.0,82.0,79.0,78.7,82.0,85.0,84.4,82.4,79.4,73.5,64.0],
  },
  uebergang: {
    werktag:  [65.7,61.2,58.5,57.0,57.4,61.6,70.7,82.4,90.7,92.5,91.4,90.7,88.5,87.0,86.2,86.7,90.2,98.0,103.0,99.7,95.5,90.6,82.5,70.5],
    samstag:  [68.4,63.6,60.6,58.4,58.0,60.0,65.0,72.7,82.0,89.4,93.7,94.5,92.6,90.0,87.4,86.0,87.5,95.0,100.7,100.0,97.4,93.0,86.0,75.5],
    sonntag:  [64.6,60.2,57.5,55.5,55.4,56.7,60.7,67.0,75.7,83.4,89.6,93.0,93.4,90.7,86.4,83.6,84.5,91.5,97.6,98.0,95.4,91.4,84.7,74.4],
  },
};

// Saisongrenzen nach BDEW (Tag-im-Jahr-Index, 1-365)
// Winter: 1.1.-20.3. (Tag 1-79) und 1.11.-31.12. (Tag 305-365)
// Übergang: 21.3.-14.5. (Tag 80-134) und 15.9.-31.10. (Tag 258-304)
// Sommer: 15.5.-14.9. (Tag 135-257)
function getBdewSeason(dayOfYear) {
  if (dayOfYear >= 135 && dayOfYear <= 257) return 'sommer';
  if ((dayOfYear >= 80 && dayOfYear <= 134) || (dayOfYear >= 258 && dayOfYear <= 304)) return 'uebergang';
  return 'winter';
}

// Dynamisierungsfunktion BDEW (offizielle Formel)
// F(t) = -3.92e-10 * t^4 + 3.20e-7 * t^3 - 7.02e-5 * t^2 + 2.10e-3 * t + 1.24
// t = Tag im Jahr (1-365)
function bdewDynamicFactor(dayOfYear) {
  const t = dayOfYear;
  return -3.92e-10 * Math.pow(t,4)
       + 3.20e-7  * Math.pow(t,3)
       - 7.02e-5  * Math.pow(t,2)
       + 2.10e-3  * t
       + 1.24;
}

// Wochentag bestimmen (1.1.2025 ist ein Mittwoch -> dayOfYear=1 -> weekday=3)
// Wir nehmen ein typisches Jahr; Startwochentag konfigurierbar
function getWeekdayType(dayOfYear, startWeekday = 3) {
  const wd = ((dayOfYear - 1 + startWeekday) % 7); // 0=So, 1=Mo, ..., 6=Sa
  if (wd === 0) return 'sonntag';
  if (wd === 6) return 'samstag';
  return 'werktag';
}

// Profile fuer Waerme (Heizung), Warmwasser, EV - mit eigenen Stundenmustern
// Diese werden eigenstaendig generiert (nicht BDEW H0)
const SUB_PROFILES = {
  waerme: {
    // Heizung: stark wettergetrieben, Tagesgang mit Morgen+Abendpeak
    winter:    [0.045,0.042,0.040,0.040,0.045,0.060,0.075,0.060,0.045,0.038,0.035,0.032,0.030,0.030,0.032,0.038,0.050,0.060,0.055,0.050,0.045,0.040,0.038,0.035],
    uebergang: [0.030,0.028,0.026,0.026,0.030,0.040,0.055,0.045,0.030,0.025,0.022,0.020,0.020,0.020,0.022,0.025,0.035,0.045,0.040,0.035,0.030,0.026,0.024,0.022],
    sommer:    [0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005],
  },
  warmwasser: {
    // Konzentration auf Tagesstunden 6-18h (PV-Eigenverbrauch optimiert)
    // Stunden 0-5 und 18-23 = nahezu Null, Hauptverteilung Mittag/Nachmittag
    winter:    [0,0,0,0,0,0,0.020,0.060,0.090,0.110,0.115,0.120,0.115,0.110,0.100,0.085,0.060,0.030,0.015,0,0,0,0,0],
    uebergang: [0,0,0,0,0,0,0.022,0.062,0.092,0.110,0.115,0.118,0.115,0.110,0.100,0.085,0.062,0.030,0.015,0,0,0,0,0],
    sommer:    [0,0,0,0,0,0,0.025,0.065,0.092,0.110,0.115,0.118,0.115,0.110,0.100,0.085,0.060,0.030,0.015,0,0,0,0,0],
  },
  ev: {
    // E-Auto: Hauptladung abends/nachts
    winter:    [0.080,0.080,0.075,0.060,0.040,0.020,0.010,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.010,0.030,0.060,0.080,0.090,0.090,0.085,0.080],
    uebergang: [0.080,0.080,0.075,0.060,0.040,0.020,0.010,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.010,0.030,0.060,0.080,0.090,0.090,0.085,0.080],
    sommer:    [0.080,0.080,0.075,0.060,0.040,0.020,0.010,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.005,0.010,0.030,0.060,0.080,0.090,0.090,0.085,0.080],
  },
};

// PV-Tagesgang nach Saison (normiert, Summe je Tag = ca. mittlerer Tagesertrag-Faktor)
const PV_PROFILE = {
  winter:    [0,0,0,0,0,0,0,0.005,0.025,0.055,0.075,0.085,0.085,0.075,0.055,0.025,0.005,0,0,0,0,0,0,0],
  uebergang: [0,0,0,0,0,0,0.010,0.035,0.070,0.095,0.110,0.115,0.115,0.110,0.095,0.070,0.035,0.010,0,0,0,0,0,0],
  sommer:    [0,0,0,0,0,0.005,0.025,0.060,0.095,0.120,0.135,0.140,0.140,0.135,0.120,0.095,0.060,0.030,0.010,0.005,0,0,0,0],
};

// Deterministischer PRNG fuer reproduzierbare Wettersimulation (Mulberry32)
function makeRng(seed) {
  let a = seed >>> 0;
  return function() {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = a;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// Gauss aus uniform via Box-Muller
function gauss(rng) {
  const u1 = Math.max(rng(), 1e-9);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function useViewport() {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    isMobile: typeof window !== 'undefined' ? window.innerWidth < 768 : false,
  }));
  useEffect(() => {
    const handle = () => setSize({width: window.innerWidth, isMobile: window.innerWidth < 768});
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return size;
}

// ============================================================
// HAUSHALTS-LAST: BDEW H0 mit Dynamisierung und Wochentagslogik
// ============================================================
function generateBdewLoad(annualKWh, rng) {
  const result = new Array(8760).fill(0);
  let rawSum = 0;
  
  // 1. Pass: rohe Werte berechnen (BDEW * Dynamisierung * Tagesvariation)
  for (let day = 0; day < 365; day++) {
    const doy = day + 1;
    const season = getBdewSeason(doy);
    const dayType = getWeekdayType(doy);
    const dynFactor = bdewDynamicFactor(doy);
    // Tagesvariation: kleine Lognormal-Schwankung um 1.0 (sigma 0.08)
    const dailyVar = Math.exp(gauss(rng) * 0.08);
    const profile = BDEW_H0[season][dayType];
    
    for (let h = 0; h < 24; h++) {
      const v = profile[h] * dynFactor * dailyVar;
      result[day*24 + h] = v;
      rawSum += v;
    }
  }
  
  // 2. Pass: auf Jahresverbrauch normieren
  const norm = annualKWh / rawSum;
  for (let i = 0; i < 8760; i++) result[i] *= norm;
  return result;
}

// ============================================================
// SUB-VERBRAUCH: Waerme/Warmwasser/EV mit Tagesvariation
// ============================================================
function generateSubLoad(profile, annualKWh, rng, varSigma = 0.10) {
  const result = new Array(8760).fill(0);
  let rawSum = 0;
  
  for (let day = 0; day < 365; day++) {
    const doy = day + 1;
    const season = getBdewSeason(doy);
    const dailyVar = Math.exp(gauss(rng) * varSigma);
    const dayProfile = profile[season];
    
    for (let h = 0; h < 24; h++) {
      const v = dayProfile[h] * dailyVar;
      result[day*24 + h] = v;
      rawSum += v;
    }
  }
  
  if (rawSum === 0) return result;
  const norm = annualKWh / rawSum;
  for (let i = 0; i < 8760; i++) result[i] *= norm;
  return result;
}

// ============================================================
// PV-PROFIL mit realistischer Wetterverteilung
// DWD-Statistik: ~25% Sonnentage, ~40% Mischtage, ~35% bedeckte Tage
// Bedeckungsindex pro Tag aus Beta-Verteilung (saisonal versch.)
// ============================================================
function generatePVAnnual(annualKWh, rng) {
  const result = new Array(8760).fill(0);
  let rawSum = 0;
  
  // Saisonale Wetterhaeufigkeiten (Beta-Verteilung approximiert)
  // Index 0..1: 0=bedeckt, 1=sonnig
  const weatherProb = {
    winter:    () => Math.pow(rng(), 1.5),         // tendenziell bewoelkt: 0.0-0.7
    uebergang: () => 0.2 + 0.7 * Math.pow(rng(), 0.9),  // breit: 0.2-0.9
    sommer:    () => 0.3 + 0.7 * Math.pow(rng(), 0.6),  // tendenziell hell: 0.3-1.0
  };
  
  for (let day = 0; day < 365; day++) {
    const doy = day + 1;
    const season = getBdewSeason(doy);
    const cloudIndex = weatherProb[season](); // 0=bedeckt, 1=sonnig
    // Faktor 0.15 (sehr bedeckt) bis 1.05 (klar)
    const dayFactor = 0.15 + 0.90 * cloudIndex;
    // Zusaetzlich kleine stundenweise Schwankung (Wolkenzug)
    const dayProfile = PV_PROFILE[season];
    
    for (let h = 0; h < 24; h++) {
      const baseValue = dayProfile[h];
      // Stundenweise Mikroschwankung nur wenn Sonne scheint
      const microVar = baseValue > 0 ? (1 + gauss(rng) * 0.10) : 1;
      const v = baseValue * dayFactor * Math.max(0.5, microVar);
      result[day*24 + h] = v;
      rawSum += v;
    }
  }
  
  if (rawSum === 0) return result;
  const norm = annualKWh / rawSum;
  for (let i = 0; i < 8760; i++) result[i] *= norm;
  return result;
}

function simulate(load, pv, batteryKWh, batteryEfficiency = 0.92, maxCRate = 0.5) {
  const n = load.length;
  const soc = new Array(n).fill(0);
  const gridImport = new Array(n).fill(0);
  const gridExport = new Array(n).fill(0);
  const batteryCharge = new Array(n).fill(0);
  const batteryDischarge = new Array(n).fill(0);
  const maxPower = batteryKWh * maxCRate;
  let currentSoc = 0;
  for (let i = 0; i < n; i++) {
    const netto = pv[i] - load[i];
    if (netto >= 0) {
      const chargeRoom = batteryKWh - currentSoc;
      const chargePossible = batteryKWh > 0 ? Math.min(netto, chargeRoom / Math.sqrt(batteryEfficiency), maxPower) : 0;
      const energyStored = chargePossible * Math.sqrt(batteryEfficiency);
      currentSoc += energyStored;
      batteryCharge[i] = chargePossible;
      gridExport[i] = netto - chargePossible;
    } else {
      const need = -netto;
      const dischargePossible = batteryKWh > 0 ? Math.min(need / Math.sqrt(batteryEfficiency), currentSoc, maxPower) : 0;
      const energyDelivered = dischargePossible * Math.sqrt(batteryEfficiency);
      currentSoc -= dischargePossible;
      batteryDischarge[i] = energyDelivered;
      gridImport[i] = need - energyDelivered;
    }
    soc[i] = currentSoc;
  }
  return { soc, gridImport, gridExport, batteryCharge, batteryDischarge };
}

function sum(arr) { return arr.reduce((a,b)=>a+b, 0); }

function annuity(rate, years) {
  if (rate === 0) return 1/years;
  return (rate * Math.pow(1+rate, years)) / (Math.pow(1+rate, years) - 1);
}

// ============================================================
// Einspeise-Erloes Berechnung mit drei Modi
// fest:         Volle Verguetung fuer alle eingespeisten kWh
// keinNegativ:  Keine Verguetung in Stunden mit negativen Boersenpreisen (~PV-Spitzen)
// nie:          Gar keine Verguetung
// ============================================================
function calcEinspeiseErloes(gridExport, pvShape, einspeiseverguetung, modus) {
  if (modus === 'nie') return 0;
  if (modus === 'fest') {
    return sum(gridExport) * einspeiseverguetung;
  }
  // 'keinNegativ': Stunden mit negativen Preisen identifizieren
  // Heuristik: Negative Preise treten bei PV-Spitzen tagsueber auf, wenn
  // viel Sonneneinstrahlung + niedriger Verbrauch (Sommer-Mittag).
  // Wir markieren die obersten ~7% der PV-Stunden als "negativ-Preis-Stunden"
  // (entspricht etwa der Beobachtung 2024 in DE).
  const sortedPV = [...pvShape].sort((a,b) => b - a);
  const cutoffIdx = Math.floor(sortedPV.length * 0.07);
  const cutoffValue = sortedPV[cutoffIdx];
  
  let erloes = 0;
  for (let i = 0; i < gridExport.length; i++) {
    if (gridExport[i] > 0 && pvShape[i] < cutoffValue) {
      erloes += gridExport[i] * einspeiseverguetung;
    }
  }
  return erloes;
}

function evaluateConfig(load, totalLoad, kwp, batteryKWh, params, pvShape) {
  // pvShape ist ein normiertes 8760h-Profil mit Summe = pvSpezErtrag (kWh/kWp)
  // Skalierung mit kWp gibt den korrekten Lastgang
  const pv = kwp > 0
    ? pvShape.map(v => v * kwp)
    : new Array(8760).fill(0);
  const pvAnnual = kwp * params.pvSpezErtrag;
  const result = simulate(load, pv, batteryKWh);
  
  const totalPV = pvAnnual;
  const totalImport = sum(result.gridImport);
  const totalExport = sum(result.gridExport);
  const eigenverbrauch = totalPV - totalExport;
  const autarkie = totalLoad > 0 ? (totalLoad - totalImport) / totalLoad : 0;
  const eigenverbrauchsquote = totalPV > 0 ? eigenverbrauch / totalPV : 0;

  const pvInvest = kwp * params.pvKostenProKWp;
  const speicherInvest = batteryKWh * params.speicherKostenProKWh;
  const totalInvest = pvInvest + speicherInvest;
  
  const pvAnnuity = kwp > 0 ? pvInvest * annuity(params.zinssatz, params.pvLebensdauer) : 0;
  const speicherAnnuity = batteryKWh > 0 ? speicherInvest * annuity(params.zinssatz, params.speicherLebensdauer) : 0;
  const betriebskosten = totalInvest * params.betriebskostenAnteil;
  
  const stromkostenOhnePV = totalLoad * params.strompreis;
  const einspeiseErloes = calcEinspeiseErloes(result.gridExport, pv, params.einspeiseverguetung, params.einspeiseModus || 'fest');
  const stromkostenMitPV = totalImport * params.strompreis - einspeiseErloes;
  const ersparnis = stromkostenOhnePV - stromkostenMitPV;
  const jahreskostenPV = pvAnnuity + speicherAnnuity + betriebskosten;
  const nettoErsparnis = ersparnis - jahreskostenPV;
  
  const cfPerYear = ersparnis - betriebskosten;
  const amortisation = cfPerYear > 0 ? totalInvest / cfPerYear : Infinity;
  const roi = totalInvest > 0 ? cfPerYear / totalInvest : 0;
  
  return {
    kwp, batteryKWh,
    autarkie, eigenverbrauchsquote, totalImport, totalExport, eigenverbrauch,
    totalInvest, nettoErsparnis, ersparnis, amortisation, roi, jahreskostenPV
  };
}

function runOptimizer(load, totalLoad, params, constraints) {
  const { kwpMin, kwpMax, kwhMin, kwhMax, minROI } = constraints;
  const kwpSteps = [];
  const kwhSteps = [];
  const kwpStep = 0.5;
  const kwhStep = 0.5;
  for (let k = kwpMin; k <= kwpMax + 1e-9; k += kwpStep) kwpSteps.push(Math.round(k*10)/10);
  for (let b = kwhMin; b <= kwhMax + 1e-9; b += kwhStep) kwhSteps.push(Math.round(b*10)/10);
  
  // PV-Shape einmal vorberechnen (deterministisch via Seed)
  // pvShape: 8760h Profil normiert auf 1 kWp -> Summe = pvSpezErtrag
  const pvRng = makeRng(params.weatherSeed || 42);
  const pvShape = generatePVAnnual(params.pvSpezErtrag, pvRng);
  
  const results = [];
  for (const kwp of kwpSteps) {
    for (const kwh of kwhSteps) {
      results.push(evaluateConfig(load, totalLoad, kwp, kwh, params, pvShape));
    }
  }
  
  const inBounds = results.filter(r =>
    r.kwp >= kwpMin && r.kwp <= kwpMax &&
    r.batteryKWh >= kwhMin && r.batteryKWh <= kwhMax
  );
  
  // ============================================================
  // EXTREMSTRATEGIEN
  // ============================================================
  const maxNettoErsparnis = inBounds.reduce((a,b) => b.nettoErsparnis > a.nettoErsparnis ? b : a);
  const maxROI = inBounds.filter(r => r.totalInvest > 0).reduce((a,b) => b.roi > a.roi ? b : a, {roi: -Infinity});
  const wirtschaftlich = inBounds.filter(r => r.nettoErsparnis >= 0);
  const maxWirtschaftlicheAutarkie = wirtschaftlich.length > 0
    ? wirtschaftlich.reduce((a,b) => b.autarkie > a.autarkie ? b : a)
    : null;
  
  // ============================================================
  // PARETO-FRONT
  // ============================================================
  const sorted = [...inBounds].sort((a,b) => a.totalInvest - b.totalInvest);
  const pareto = [];
  let bestCF = -Infinity;
  for (const r of sorted) {
    const cf = r.ersparnis - (r.totalInvest * params.betriebskostenAnteil);
    if (cf > bestCF) {
      pareto.push({...r, cashflow: cf});
      bestCF = cf;
    }
  }
  
  // ============================================================
  // KNIE-PUNKT-METHODEN (alle drei werden berechnet und gezeigt)
  // ============================================================
  let kneePoint = null, sharpePoint = null, elasticityPoint = null;
  
  if (pareto.length >= 3) {
    const front = pareto.filter(p => p.totalInvest > 0);
    
    if (front.length >= 3) {
      // KNEEDLE: Punkt mit max. orthogonaler Distanz zur Sehne
      const xMin = front[0].totalInvest;
      const xMax = front[front.length-1].totalInvest;
      const yMin = front[0].cashflow;
      const yMax = front[front.length-1].cashflow;
      const xRange = xMax - xMin || 1;
      const yRange = yMax - yMin || 1;
      kneePoint = front.map(p => ({
        ...p,
        kneeDistance: ((p.cashflow - yMin) / yRange) - ((p.totalInvest - xMin) / xRange),
      })).reduce((a,b) => b.kneeDistance > a.kneeDistance ? b : a);
      
      // SHARPE-ANALOG: max. (Cashflow - rf*Invest) / sqrt(Invest)
      const rf = minROI;
      const aboveHurdle = front.filter(p => p.cashflow - rf * p.totalInvest > 0);
      sharpePoint = aboveHurdle.length > 0
        ? aboveHurdle.map(p => ({
            ...p,
            sharpeAnalog: (p.cashflow - rf * p.totalInvest) / Math.sqrt(p.totalInvest),
          })).reduce((a,b) => b.sharpeAnalog > a.sharpeAnalog ? b : a)
        : null;
      
      // ELASTIZITAET: log-log-Steigung faellt unter 0.5
      elasticityPoint = front[front.length-1];
      for (let i = 1; i < front.length; i++) {
        const prev = front[i-1];
        const curr = front[i];
        if (prev.totalInvest <= 0 || prev.cashflow <= 0) continue;
        const dLogX = Math.log(curr.totalInvest) - Math.log(prev.totalInvest);
        const dLogY = Math.log(Math.max(0.01, curr.cashflow)) - Math.log(Math.max(0.01, prev.cashflow));
        const elasticity = dLogX > 0 ? dLogY / dLogX : 0;
        if (elasticity < 0.5) { elasticityPoint = prev; break; }
        elasticityPoint = curr;
      }
    }
  }
  
  // Marginal-ROI-Kurve fuer Visualisierung
  const marginalCurve = [];
  for (let i = 1; i < pareto.length; i++) {
    const prev = pareto[i-1];
    const curr = pareto[i];
    const deltaInvest = curr.totalInvest - prev.totalInvest;
    const deltaCashflow = curr.cashflow - prev.cashflow;
    marginalCurve.push({
      totalInvest: curr.totalInvest,
      kwp: curr.kwp,
      batteryKWh: curr.batteryKWh,
      marginalROI: deltaInvest > 0 ? deltaCashflow / deltaInvest : 0,
      cashflow: curr.cashflow,
      autarkie: curr.autarkie,
      deltaInvest,
      deltaCashflow,
    });
  }
  
  // ============================================================
  // Einheitliche Strategie-Liste mit Metadaten
  // ============================================================
  const strategies = [
    {
      id: 'kneedle',
      label: 'Bester Kompromiss',
      group: 'pareto',
      color: '#22d3ee',
      shape: 'diamond',
      config: kneePoint,
      desc: 'Der ausgewogenste Punkt zwischen Investition und Ertrag.',
      explainer: 'Findet den "Sweet Spot" zwischen zu kleiner und zu großer Anlage. Das ist der Punkt, an dem die Anlage groß genug ist um spürbar zu wirken, aber noch nicht so groß, dass die zusätzlichen Module schlechter rentieren. Bei einer typischen Anlage ist das die Empfehlung. (Mathematisch: Knie-Punkt der Pareto-Front, Kneedle-Algorithmus)',
    },
    {
      id: 'sharpe',
      label: 'Beste Effizienz',
      group: 'pareto',
      color: '#fbbf24',
      shape: 'triangle',
      config: sharpePoint,
      desc: 'Bestes Verhältnis aus Mehrertrag und Mehraufwand.',
      explainer: 'Berücksichtigt, dass größere Anlagen mehr Kapital binden und damit mehr Risiko tragen. Wählt die Größe, bei der jeder eingesetzte Euro bestmöglich genutzt wird, gewichtet nach Investitionsumfang. Tendiert zu mittel-großen Anlagen. (Mathematisch: Analog zur Sharpe-Ratio aus der Portfolio-Theorie)',
    },
    {
      id: 'elasticity',
      label: 'Sicher investiert',
      group: 'pareto',
      color: '#a78bfa',
      shape: 'square',
      config: elasticityPoint,
      desc: 'Die zurückhaltende Variante.',
      explainer: 'Stoppt dort, wo zusätzliche Investition nicht mehr proportional belohnt wird, also dort wo eine Verdopplung der Anlage weniger als eine Wurzel-Verdopplung im Ertrag bringt. Tendiert zu kleineren Anlagen. Sinnvoll wenn du auf Nummer sicher gehen willst und kein Geld in vielleicht-noch-rentablen Modulen binden möchtest. (Mathematisch: Elastizitäts-Schwellenwert in log-log-Darstellung)',
    },
    {
      id: 'maxNetto',
      label: 'Höchster Gewinn pro Jahr',
      group: 'extrem',
      color: '#10b981',
      shape: 'star',
      config: maxNettoErsparnis,
      desc: 'Maximaler Eurobetrag im Konto pro Jahr.',
      explainer: 'Maximiert den absoluten Gewinn nach Abzug aller Kapitalkosten, ohne Rücksicht auf Effizienz. Eine 30-kWp-Anlage kann mehr absoluten Gewinn liefern als eine 12-kWp-Anlage, selbst wenn jeder einzelne Euro bei der kleineren Anlage besser arbeitet. Sinnvoll bei unbegrenztem Kapital. (Mathematisch: Max. Netto-Cashflow)',
    },
    {
      id: 'maxROI',
      label: 'Beste Verzinsung',
      group: 'extrem',
      color: '#06b6d4',
      shape: 'wye',
      config: maxROI,
      desc: 'Höchste prozentuale Rendite auf das Kapital.',
      explainer: 'Maximiert die Rendite in Prozent (Gewinn pro investiertem Euro). Wählt typischerweise kleine Anlagen, weil dort die ersten Module die effizientesten sind. Sinnvoll bei stark begrenztem Kapital oder als Vergleichsanker. (Mathematisch: Max. ROI = Cashflow / Investition)',
    },
    {
      id: 'maxAutarkie',
      label: 'Größtmögliche Unabhängigkeit',
      group: 'extrem',
      color: '#f472b6',
      shape: 'circle',
      config: maxWirtschaftlicheAutarkie,
      desc: 'Höchster Autarkiegrad ohne Verlust zu machen.',
      explainer: 'Maximiert die Unabhängigkeit vom Stromnetz unter der Bedingung, dass die Anlage sich noch selbst trägt (kein Jahresverlust). Sinnvoll wenn Unabhängigkeit als Wert an sich verfolgt wird, etwa wegen Strompreis-Sorgen oder Resilienz bei Netzproblemen. Akzeptiert dafür eine geringere Rendite.',
    },
  ];
  
  return {
    results: inBounds,
    pareto,
    marginalCurve,
    strategies,
    constraints,
  };
}

const STORAGE_KEY = 'prosumer_tool_state_v7';

const DEFAULTS = {
  haushaltKWh: 2500, waermeKWh: 6000, warmwasserKWh: 0, evKWh: 1500,
  pvAktiv: true, pvKWp: 10, pvSpezErtrag: 1000,
  speicherAktiv: true, speicherKWh: 10,
  strompreis: 0.32, einspeiseverguetung: 0.0786,
  einspeiseModus: 'fest', // 'fest' | 'keinNegativ' | 'nie'
  pvKostenProKWp: 800, speicherKostenProKWh: 400,
  pvLebensdauer: 25, speicherLebensdauer: 15,
  zinssatz: 0.00, betriebskostenAnteil: 0.0,
  strompreissteigerung: 0.03,
  optKwpMin: 0, optKwpMax: 20,
  optKwhMin: 0, optKwhMax: 15,
  optMinROI: 0.05,
  weatherSeed: 42,
};

export default function ProsumerTool() {
  const [state, setState] = useState(DEFAULTS);
  const [loaded, setLoaded] = useState(false);
  const [activeTab, setActiveTab] = useState('verbrauch');
  const [optimizing, setOptimizing] = useState(false);
  const [optResult, setOptResult] = useState(null);
  const {isMobile} = useViewport();

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setState({...DEFAULTS, ...parsed});
      }
    } catch (e) {}
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      } catch(e) {}
    }, 500);
    return () => clearTimeout(t);
  }, [state, loaded]);

  const update = (key, val) => setState(s => ({...s, [key]: val}));
  const reset = () => { setState(DEFAULTS); setOptResult(null); };

  const sim = useMemo(() => {
    // Deterministische Wettersimulation: gleicher Seed = gleiches Wetterjahr,
    // damit Vergleiche zwischen Konfigurationen sinnvoll sind
    const seed = state.weatherSeed || 42;
    const haushaltRng = makeRng(seed);
    const waermeRng   = makeRng(seed + 1);
    const wwRng       = makeRng(seed + 2);
    const evRng       = makeRng(seed + 3);
    const pvRng       = makeRng(seed + 4);
    
    const haushalt   = generateBdewLoad(state.haushaltKWh, haushaltRng);
    const waerme     = generateSubLoad(SUB_PROFILES.waerme, state.waermeKWh, waermeRng, 0.20);
    const warmwasser = generateSubLoad(SUB_PROFILES.warmwasser, state.warmwasserKWh, wwRng, 0.10);
    const ev         = generateSubLoad(SUB_PROFILES.ev, state.evKWh, evRng, 0.15);

    const load = haushalt.map((v,i) => v + waerme[i] + warmwasser[i] + ev[i]);
    const pvAnnual = state.pvAktiv ? state.pvKWp * state.pvSpezErtrag : 0;
    const pv = state.pvAktiv ? generatePVAnnual(pvAnnual, pvRng) : new Array(8760).fill(0);
    const battKWh = state.speicherAktiv ? state.speicherKWh : 0;
    const result = simulate(load, pv, battKWh);
    
    const totalLoad = sum(load);
    const totalPV = sum(pv);
    const totalImport = sum(result.gridImport);
    const totalExport = sum(result.gridExport);
    const eigenverbrauch = totalPV - totalExport;
    const autarkie = totalLoad > 0 ? (totalLoad - totalImport) / totalLoad : 0;
    const eigenverbrauchsquote = totalPV > 0 ? eigenverbrauch / totalPV : 0;

    const pvInvest = state.pvAktiv ? state.pvKWp * state.pvKostenProKWp : 0;
    const speicherInvest = state.speicherAktiv ? state.speicherKWh * state.speicherKostenProKWh : 0;
    const totalInvest = pvInvest + speicherInvest;
    const pvAnnuity = state.pvAktiv ? pvInvest * annuity(state.zinssatz, state.pvLebensdauer) : 0;
    const speicherAnnuity = state.speicherAktiv ? speicherInvest * annuity(state.zinssatz, state.speicherLebensdauer) : 0;
    const betriebskosten = totalInvest * state.betriebskostenAnteil;
    const stromkostenOhnePV = totalLoad * state.strompreis;
    const einspeiseErloes = calcEinspeiseErloes(result.gridExport, pv, state.einspeiseverguetung, state.einspeiseModus || 'fest');
    const stromkostenMitPV = totalImport * state.strompreis - einspeiseErloes;
    const ersparnis = stromkostenOhnePV - stromkostenMitPV;
    const jahreskostenPV = pvAnnuity + speicherAnnuity + betriebskosten;
    const nettoErsparnis = ersparnis - jahreskostenPV;
    const lcoeEigenverbrauch = eigenverbrauch > 0 ? (pvAnnuity + speicherAnnuity + betriebskosten) / eigenverbrauch : 0;
    const cfPerYear = ersparnis - betriebskosten;
    const amortisation = cfPerYear > 0 ? totalInvest / cfPerYear : Infinity;

    const daily = aggregateDaily({
      load, pv,
      gridImport: result.gridImport, gridExport: result.gridExport,
      soc: result.soc,
      batteryCharge: result.batteryCharge, batteryDischarge: result.batteryDischarge,
      haushalt, waerme, warmwasser, ev,
    });
    const winterDay = extractDay({load, pv, gridImport: result.gridImport, gridExport: result.gridExport, soc: result.soc}, 15);
    const sommerDay = extractDay({load, pv, gridImport: result.gridImport, gridExport: result.gridExport, soc: result.soc}, 196);
    const monthly = aggregateMonthly({
      load, pv,
      gridImport: result.gridImport,
      gridExport: result.gridExport,
      batteryDischarge: result.batteryDischarge,
    });
    
    // Heatmaps: 365x24 Matrizen (downsampled auf 73 Tage fuer Performance)
    const downsample = 5; // 5-Tages-Mittel = 73 Spalten
    const heatmapLoad = aggregateHeatmap(load, downsample);
    const heatmapPV = aggregateHeatmap(pv, downsample);
    const heatmapImport = aggregateHeatmap(result.gridImport, downsample);
    const heatmapBattery = aggregateHeatmap(result.soc, downsample);
    
    return {
      load, totalLoad, totalPV, totalImport, totalExport, eigenverbrauch, autarkie, eigenverbrauchsquote,
      pvInvest, speicherInvest, totalInvest, pvAnnuity, speicherAnnuity, betriebskosten,
      stromkostenOhnePV, stromkostenMitPV, ersparnis, jahreskostenPV, nettoErsparnis,
      einspeiseErloes,
      lcoeEigenverbrauch, amortisation,
      daily, winterDay, sommerDay, monthly,
      heatmapLoad, heatmapPV, heatmapImport, heatmapBattery,
    };
  }, [state]);

  const handleOptimize = async () => {
    setOptimizing(true);
    setOptResult(null);
    setTimeout(() => {
      const params = {
        pvSpezErtrag: state.pvSpezErtrag,
        pvKostenProKWp: state.pvKostenProKWp,
        speicherKostenProKWh: state.speicherKostenProKWh,
        pvLebensdauer: state.pvLebensdauer,
        speicherLebensdauer: state.speicherLebensdauer,
        zinssatz: state.zinssatz,
        betriebskostenAnteil: state.betriebskostenAnteil,
        strompreis: state.strompreis,
        einspeiseverguetung: state.einspeiseverguetung,
        weatherSeed: state.weatherSeed || 42,
        einspeiseModus: state.einspeiseModus || 'fest',
      };
      const constraints = {
        kwpMin: state.optKwpMin,
        kwpMax: state.optKwpMax,
        kwhMin: state.optKwhMin,
        kwhMax: state.optKwhMax,
        minROI: state.optMinROI,
      };
      const res = runOptimizer(sim.load, sim.totalLoad, params, constraints);
      setOptResult(res);
      setOptimizing(false);
    }, 50);
  };
  
  const applyOptimum = (config) => {
    if (!config) return;
    setState(s => ({
      ...s,
      pvAktiv: config.kwp > 0,
      pvKWp: config.kwp,
      speicherAktiv: config.batteryKWh > 0,
      speicherKWh: config.batteryKWh,
    }));
    setActiveTab('ergebnis');
  };

  if (!loaded) {
    return <div style={{padding: 40, fontFamily: 'monospace', background: '#f9fafb', color: '#4b5563', minHeight: '100vh'}}>Lade gespeicherten Zustand…</div>;
  }

  const containerPadding = isMobile ? '20px 16px' : '32px 40px';
  const headerTitleSize = isMobile ? 28 : 42;

  return (
    <div style={{...styles.container, padding: containerPadding}}>
      <style>{globalCss}</style>
      
      <header style={{...styles.header, flexDirection: isMobile ? 'column' : 'row', alignItems: isMobile ? 'flex-start' : 'flex-end', gap: isMobile ? 16 : 0}}>
        <div>
          <div style={styles.headerLabel}>PROSUMER · OPTIMIZER</div>
          <h1 style={{...styles.headerTitle, fontSize: headerTitleSize}}>Eigenverbrauchs&shy;analyse</h1>
          <div style={styles.headerSub}>PV · Speicher · Lastgang · Wirtschaftlichkeit</div>
        </div>
        <button onClick={reset} style={styles.resetBtn}>Reset</button>
      </header>

      {/* Persistente KPI-Bar mit Tooltips */}
      <PersistentKpiBar sim={sim} isMobile={isMobile} />

      <nav style={{...styles.tabNav, overflowX: 'auto', flexWrap: 'nowrap', WebkitOverflowScrolling: 'touch'}}>
        {[
          {id:'verbrauch',  label: isMobile ? '01' : '01 · Verbrauch'},
          {id:'erzeugung',  label: isMobile ? '02' : '02 · Erzeugung & Speicher'},
          {id:'wirtschaft', label: isMobile ? '03' : '03 · Wirtschaftlichkeit'},
          {id:'optimierer', label: isMobile ? '04 ★' : '04 · Optimierer'},
          {id:'ergebnis',   label: isMobile ? '05' : '05 · Ergebnis'},
        ].map(t => (
          <button key={t.id} onClick={()=>setActiveTab(t.id)} style={{...styles.tabBtn, ...(activeTab===t.id ? styles.tabBtnActive : {}), padding: isMobile ? '12px 14px' : '12px 20px', whiteSpace:'nowrap'}}>
            {t.label}
          </button>
        ))}
      </nav>

      <main style={styles.main}>
        {activeTab === 'verbrauch' && <VerbrauchPanel state={state} update={update} sim={sim} isMobile={isMobile} />}
        {activeTab === 'erzeugung' && <ErzeugungPanel state={state} update={update} sim={sim} isMobile={isMobile} />}
        {activeTab === 'wirtschaft' && <WirtschaftPanel state={state} update={update} sim={sim} isMobile={isMobile} />}
        {activeTab === 'optimierer' && <OptimiererPanel state={state} update={update} sim={sim} isMobile={isMobile}
            onOptimize={handleOptimize} optimizing={optimizing} optResult={optResult} applyOptimum={applyOptimum} />}
        {activeTab === 'ergebnis' && <ErgebnisPanel sim={sim} state={state} isMobile={isMobile} />}
      </main>

      <footer style={{...styles.footer, flexDirection: isMobile ? 'column' : 'row', gap: isMobile ? 6 : 0, fontSize: 9}}>
        <span>Lastgang 8760h · BDEW H0 · VDI 4655 · normiert</span>
        <span>Eingaben werden lokal gespeichert</span>
      </footer>
    </div>
  );
}

function VerbrauchPanel({state, update, sim, isMobile}) {
  const total = state.haushaltKWh + state.waermeKWh + state.warmwasserKWh + state.evKWh;
  const gridStyle = isMobile ? styles.gridMobile : styles.grid2;
  
  return (
    <div style={styles.panel}>
      <SectionTitle nr="01" title="Verbrauchskomponenten" sub="Jahresverbrauch je Sektor festlegen" isMobile={isMobile} />
      <div style={gridStyle}>
        <div style={styles.card}>
          <Slider label="Haushaltsstrom" value={state.haushaltKWh} min={0} max={15000} step={100} unit="kWh/a" onChange={v=>update('haushaltKWh',v)} hint="Typ. 4-Pers-HH: 3500-5500 kWh/a" />
          <Slider label="Waerme (Heizung)" value={state.waermeKWh} min={0} max={30000} step={250} unit="kWh/a" onChange={v=>update('waermeKWh',v)} hint="WP-EFH unsaniert: 8-15.000 / saniert: 4-8.000" />
          <Slider label="Warmwasser" value={state.warmwasserKWh} min={0} max={6000} step={50} unit="kWh/a" onChange={v=>update('warmwasserKWh',v)} hint="2-3 Pers: 1500 / 4 Pers: 2500-3000" />
          <Slider label="E-Auto (Heimladung)" value={state.evKWh} min={0} max={15000} step={100} unit="kWh/a" onChange={v=>update('evKWh',v)} hint="15.000 km/a × 18 kWh/100km = 2700 kWh" />
          <div style={styles.totalRow}>
            <span>Gesamt</span>
            <strong>{total.toLocaleString('de-DE')} kWh/a</strong>
          </div>
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Jährliche Lastkurve · nach Verbrauchstyp</div>
          <ResponsiveContainer width="100%" height={isMobile ? 200 : 260}>
            <AreaChart data={sim.daily} margin={{top:10,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
              <XAxis dataKey="day" tick={{fill:'#6b7280', fontSize:10}} interval={isMobile ? 60 : 29} />
              <YAxis tick={{fill:'#6b7280', fontSize:10}} />
              <Tooltip
                content={({active, payload, label}) => {
                  if (!active || !payload || !payload.length) return null;
                  const d = payload[0].payload;
                  const total = d.haushalt + d.waerme + d.warmwasser + d.ev;
                  return (
                    <div style={{background:'#ffffff', border:'1px solid #e5e7eb', padding:'10px 12px', fontFamily:'Arial, sans-serif', fontSize:11, lineHeight:1.5}}>
                      <div style={{color:'#111827', marginBottom:4, fontWeight:700}}>Tag {label}</div>
                      <div style={{color:'#3b82f6'}}>Haushalt: {d.haushalt.toFixed(1)} kWh</div>
                      <div style={{color:'#ef4444'}}>Wärme: {d.waerme.toFixed(1)} kWh</div>
                      <div style={{color:'#fbbf24'}}>Warmwasser: {d.warmwasser.toFixed(1)} kWh</div>
                      <div style={{color:'#a78bfa'}}>E-Auto: {d.ev.toFixed(1)} kWh</div>
                      <div style={{borderTop:'1px solid #e5e7eb', marginTop:4, paddingTop:4, color:'#111827', fontWeight:700}}>Gesamt: {total.toFixed(1)} kWh</div>
                    </div>
                  );
                }}
              />
              <Legend wrapperStyle={{fontSize:11}} />
              <Area type="monotone" dataKey="haushalt"   stackId="1" stroke="#3b82f6" fill="#3b82f6" fillOpacity={0.7} name="Haushalt" />
              <Area type="monotone" dataKey="waerme"     stackId="1" stroke="#ef4444" fill="#ef4444" fillOpacity={0.7} name="Wärme" />
              <Area type="monotone" dataKey="warmwasser" stackId="1" stroke="#fbbf24" fill="#fbbf24" fillOpacity={0.7} name="Warmwasser" />
              <Area type="monotone" dataKey="ev"         stackId="1" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.7} name="E-Auto" />
            </AreaChart>
          </ResponsiveContainer>
          <div style={{...styles.cardLabel, marginTop:20}}>Tagesprofile</div>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 200}>
            <LineChart margin={{top:10,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
              <XAxis dataKey="hour" type="number" domain={[0,23]} tick={{fill:'#6b7280', fontSize:10}} />
              <YAxis tick={{fill:'#6b7280', fontSize:10}} />
              <Tooltip contentStyle={{background:'#ffffff', border:'1px solid #e5e7eb', fontSize:12}} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Line data={sim.winterDay} type="monotone" dataKey="load" stroke="#3b82f6" name="Winter" dot={false} strokeWidth={2}/>
              <Line data={sim.sommerDay} type="monotone" dataKey="load" stroke="#ef4444" name="Sommer" dot={false} strokeWidth={2}/>
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function ErzeugungPanel({state, update, sim, isMobile}) {
  const gridStyle = isMobile ? styles.gridMobile : styles.grid2;
  return (
    <div style={styles.panel}>
      <SectionTitle nr="02" title="PV-Anlage & Batteriespeicher" sub="Komponenten dimensionieren" isMobile={isMobile} />
      <div style={gridStyle}>
        <div style={styles.card}>
          <ToggleRow label="PV-Anlage" value={state.pvAktiv} onChange={v=>update('pvAktiv',v)} />
          {state.pvAktiv && <>
            <Slider label="PV-Leistung" value={state.pvKWp} min={0} max={30} step={0.5} unit="kWp" onChange={v=>update('pvKWp',v)} hint="EFH typ. 8-15 kWp" />
            <Slider label="Spez. Ertrag" value={state.pvSpezErtrag} min={700} max={1200} step={10} unit="kWh/kWp" onChange={v=>update('pvSpezErtrag',v)} hint="DE Sued: 950-1100 / Nord: 800-900" />
            <div style={styles.infoRow}>
              <span>Jahresertrag</span>
              <strong>{(state.pvKWp*state.pvSpezErtrag).toLocaleString('de-DE')} kWh/a</strong>
            </div>
          </>}
          <div style={{height:1, background:'#e5e7eb', margin:'24px 0'}} />
          <ToggleRow label="Batteriespeicher" value={state.speicherAktiv} onChange={v=>update('speicherAktiv',v)} />
          {state.speicherAktiv && <>
            <Slider label="Speichergroesse" value={state.speicherKWh} min={0} max={30} step={0.5} unit="kWh" onChange={v=>update('speicherKWh',v)} hint="Faustregel: 1 kWh / 1000 kWh Verbrauch" />
            <div style={styles.infoRow}><span>Wirkungsgrad</span><strong>92 %</strong></div>
            <div style={styles.infoRow}><span>Max C-Rate</span><strong>0.5 C</strong></div>
          </>}
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Tagesprofil · 15. Juli</div>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
            <ComposedChart data={sim.sommerDay} margin={{top:10,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
              <XAxis dataKey="hour" tick={{fill:'#6b7280', fontSize:10}} />
              <YAxis tick={{fill:'#6b7280', fontSize:10}} />
              <Tooltip contentStyle={{background:'#ffffff', border:'1px solid #e5e7eb', fontSize:12}} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Area type="monotone" dataKey="pv" fill="#fbbf2455" stroke="#fbbf24" name="PV" />
              <Line type="monotone" dataKey="load" stroke="#ef4444" name="Last" dot={false} strokeWidth={2}/>
              <Line type="monotone" dataKey="soc" stroke="#22d3ee" name="SOC" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>
            </ComposedChart>
          </ResponsiveContainer>
          <div style={{...styles.cardLabel, marginTop:20}}>Tagesprofil · 15. Januar</div>
          <ResponsiveContainer width="100%" height={isMobile ? 180 : 220}>
            <ComposedChart data={sim.winterDay} margin={{top:10,right:10,left:-20,bottom:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
              <XAxis dataKey="hour" tick={{fill:'#6b7280', fontSize:10}} />
              <YAxis tick={{fill:'#6b7280', fontSize:10}} />
              <Tooltip contentStyle={{background:'#ffffff', border:'1px solid #e5e7eb', fontSize:12}} />
              <Legend wrapperStyle={{fontSize:11}} />
              <Area type="monotone" dataKey="pv" fill="#fbbf2455" stroke="#fbbf24" name="PV" />
              <Line type="monotone" dataKey="load" stroke="#ef4444" name="Last" dot={false} strokeWidth={2}/>
              <Line type="monotone" dataKey="soc" stroke="#22d3ee" name="SOC" dot={false} strokeWidth={1.5} strokeDasharray="4 2"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

function WirtschaftPanel({state, update, sim, isMobile}) {
  const gridStyle = isMobile ? styles.gridMobile : styles.grid2;
  return (
    <div style={styles.panel}>
      <SectionTitle nr="03" title="Wirtschaftliche Parameter" sub="Preise, Investitionen, Zins" isMobile={isMobile} />
      <div style={gridStyle}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Strompreise</div>
          <Slider label="Strompreis (Bezug)" value={state.strompreis} min={0.05} max={0.80} step={0.005} unit="EUR/kWh" decimals={3} onChange={v=>update('strompreis',v)} hint="Was du heute pro kWh aus dem Netz bezahlst. Mittelwert DE 2025: ~0.32 €/kWh" />
          <Slider label="Einspeisevergütung" value={state.einspeiseverguetung} min={0} max={0.30} step={0.001} unit="EUR/kWh" decimals={4} onChange={v=>update('einspeiseverguetung',v)} hint="Was du für ins Netz eingespeisten Strom bekommst. EEG 2025: 7,86 ct/kWh (Teileinspeisung <10 kWp)" />
          
          <div style={{marginBottom:18, marginTop:8}}>
            <div style={{color:'#6b7280', fontSize:13, letterSpacing:'0.02em', marginBottom:8}}>Vergütungsmodus</div>
            <div style={{display:'flex', gap:4, flexWrap:'wrap'}}>
              {[
                {id:'fest',         label:'Immer'},
                {id:'keinNegativ',  label:'Nicht bei negativen Preisen'},
                {id:'nie',          label:'Nie'},
              ].map(m => (
                <button key={m.id} onClick={()=>update('einspeiseModus', m.id)}
                  style={{
                    padding:'6px 10px',
                    background: state.einspeiseModus === m.id ? '#22d3ee' : 'transparent',
                    border: state.einspeiseModus === m.id ? '1px solid #22d3ee' : '1px solid #e5e7eb',
                    color: state.einspeiseModus === m.id ? '#f9fafb' : '#4b5563',
                    fontFamily: 'Arial, sans-serif',
                    fontSize: 11,
                    cursor: 'pointer',
                    fontWeight: state.einspeiseModus === m.id ? 700 : 400,
                  }}
                >{m.label}</button>
              ))}
            </div>
            <div style={{fontSize:10, color:'#9ca3af', marginTop:6, fontFamily:'Arial, sans-serif'}}>
              {state.einspeiseModus === 'fest' && 'Klassisches EEG: volle Vergütung für jede eingespeiste kWh.'}
              {state.einspeiseModus === 'keinNegativ' && 'Realistisch ab 2024: in den ~7% PV-Spitzenstunden (negative Börsenpreise) keine Vergütung.'}
              {state.einspeiseModus === 'nie' && 'Worst Case: Einspeisung wird nicht vergütet (z.B. Inselbetrieb, Direktvermarktung gescheitert).'}
            </div>
          </div>
          
          <div style={{height:1, background:'#e5e7eb', margin:'24px 0'}} />
          <div style={styles.cardLabel}>Anschaffungskosten</div>
          <Slider label="PV-Kosten" value={state.pvKostenProKWp} min={0} max={2500} step={25} unit="EUR/kWp" onChange={v=>update('pvKostenProKWp',v)} hint="Schlüsselfertig EFH: 1200-1600 €/kWp. DIY/Bestand: ab 0 €/kWp möglich." />
          <Slider label="Speicher-Kosten" value={state.speicherKostenProKWh} min={300} max={1200} step={25} unit="EUR/kWh" onChange={v=>update('speicherKostenProKWh',v)} hint="Lithium-Heimspeicher: 500-800 €/kWh inkl. Installation" />
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Lebensdauer & Zins</div>
          <Slider label="Lebensdauer PV" value={state.pvLebensdauer} min={15} max={30} step={1} unit="Jahre" onChange={v=>update('pvLebensdauer',v)} hint="Module 20-25 Jahre, Wechselrichter ggf. einmal tauschen" />
          <Slider label="Lebensdauer Speicher" value={state.speicherLebensdauer} min={8} max={20} step={1} unit="Jahre" onChange={v=>update('speicherLebensdauer',v)} hint="Garantie typ. 10 Jahre / 6000-8000 Ladezyklen" />
          <Slider label="Zinssatz" value={state.zinssatz} min={0} max={0.10} step={0.0025} unit="%" decimals={2} display={v=>(v*100).toFixed(2)} onChange={v=>update('zinssatz',v)} hint="Was kostet dich das Kapital? Eigenkapital: alternative Anlagerendite (ETF ~6%). Kredit: dein Kreditzins." />
          <Slider label="Betriebskosten" value={state.betriebskostenAnteil} min={0} max={0.04} step={0.0025} unit="%/a" decimals={2} display={v=>(v*100).toFixed(2)} onChange={v=>update('betriebskostenAnteil',v)} hint="Versicherung, Wartung, Reinigung. 1-2% der Anschaffungskosten pro Jahr" />
          <div style={{height:1, background:'#e5e7eb', margin:'24px 0'}} />
          <div style={styles.summaryGrid}>
            <Kpi label="PV-Anschaffung" value={`${sim.pvInvest.toLocaleString('de-DE',{maximumFractionDigits:0})} EUR`} />
            <Kpi label="Speicher-Anschaffung" value={`${sim.speicherInvest.toLocaleString('de-DE',{maximumFractionDigits:0})} EUR`} />
            <Kpi label="Kapitalkosten PV/a" value={`${sim.pvAnnuity.toLocaleString('de-DE',{maximumFractionDigits:0})} EUR`} />
            <Kpi label="Kapitalkosten Speicher/a" value={`${sim.speicherAnnuity.toLocaleString('de-DE',{maximumFractionDigits:0})} EUR`} />
          </div>
        </div>
      </div>
    </div>
  );
}

function OptimiererPanel({state, update, sim, isMobile, onOptimize, optimizing, optResult, applyOptimum}) {
  const gridStyle = isMobile ? styles.gridMobile : styles.grid2;
  const [expandedId, setExpandedId] = React.useState(null);
  
  return (
    <div style={styles.panel}>
      <SectionTitle nr="04" title="Optimierer" sub="Findet die wirtschaftlich beste Anlagengröße" isMobile={isMobile} />
      
      <div style={gridStyle}>
        {/* LINKE SPALTE: CONSTRAINTS */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Anlagengröße · Rahmen für die Suche</div>
          <RangeSlider label="PV-Leistung" minValue={state.optKwpMin} maxValue={state.optKwpMax}
            min={0} max={40} step={0.5} unit="kWp" decimals={1}
            onMinChange={v=>update('optKwpMin', v)}
            onMaxChange={v=>update('optKwpMax', v)}
            hint="Welche Größen sollen geprüft werden? EFH typisch 5-20 kWp" />
          <RangeSlider label="Speicher" minValue={state.optKwhMin} maxValue={state.optKwhMax}
            min={0} max={40} step={0.5} unit="kWh" decimals={1}
            onMinChange={v=>update('optKwhMin', v)}
            onMaxChange={v=>update('optKwhMax', v)}
            hint="Min=0 lässt die Optimierung entscheiden, ob ein Speicher überhaupt sinnvoll ist." />
          
          <div style={{height:1, background:'#e5e7eb', margin:'24px 0'}} />
          
          <div style={styles.cardLabel}>Vergleichszins</div>
          <Slider label="Vergleichszins" value={state.optMinROI} min={0} max={0.15} step={0.0025} unit="%" decimals={2}
            display={v=>(v*100).toFixed(2)} onChange={v=>update('optMinROI',v)}
            hint="Was würdest du sonst mit dem Geld machen? Tagesgeld ~3%, Aktien-ETF ~6%, Hypothek tilgen ~4%." />
          
          <button onClick={onOptimize} disabled={optimizing} style={{...styles.optimizeBtn, marginTop:16}}>
            {optimizing ? 'BERECHNE…' : 'OPTIMIEREN ▶'}
          </button>
          
          <div style={{fontSize:10, color:'#9ca3af', marginTop:14, fontFamily:'Arial, sans-serif', lineHeight:1.6}}>
            Die Optimierung berechnet alle möglichen Anlagengrößen im Rahmen und liefert <strong style={{color:'#4b5563'}}>sieben verschiedene Empfehlungen</strong>. Jede beantwortet die Frage "was ist die beste Größe?" auf eine andere Art.
          </div>
        </div>
        
        {/* RECHTE SPALTE: ERGEBNIS-VORSCHAU */}
        <div style={styles.card}>
          {!optResult && !optimizing && (
            <div style={{padding:'40px 20px', textAlign:'center', color:'#6b7280', fontFamily:'Arial, sans-serif', fontSize:12, lineHeight:1.7}}>
              Rahmen festlegen<br/>und Optimierung starten.<br/><br/>
              Es werden alle möglichen<br/>Anlagengrößen durchgerechnet<br/>und nach mehreren Kriterien<br/>bewertet.
            </div>
          )}
          {optimizing && (
            <div style={{padding:'40px 20px', textAlign:'center', color:'#22d3ee', fontFamily:'Arial, sans-serif', fontSize:12}}>
              <div style={{fontSize:24, marginBottom:12}}>◐</div>
              Berechne Konfigurationen…
            </div>
          )}
          {optResult && !optimizing && (
            <div>
              <div style={styles.cardLabel}>Effizienzkurve · Investition vs. Jahres-Ersparnis</div>
              <ResponsiveContainer width="100%" height={isMobile ? 280 : 360}>
                <ScatterChart margin={{top:10,right:20,left:0,bottom:30}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
                  <XAxis type="number" dataKey="totalInvest" tick={{fill:'#6b7280', fontSize:10}}
                    label={{value:'Investition [EUR]', position:'insideBottom', offset:-15, fill:'#6b7280', fontSize:11}}/>
                  <YAxis type="number" dataKey="nettoErsparnis" tick={{fill:'#6b7280', fontSize:10}}
                    label={{value:'Netto [EUR/a]', angle:-90, position:'insideLeft', fill:'#6b7280', fontSize:11}}/>
                  <Tooltip cursor={{strokeDasharray:'2 4'}}
                    content={({active, payload}) => {
                      if (!active || !payload || !payload[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div style={{background:'#ffffff', border:'1px solid #e5e7eb', padding:'8px 10px', fontFamily:'Arial, sans-serif', fontSize:11}}>
                          <div style={{color:'#111827', marginBottom:4, fontWeight:700}}>{d.kwp} kWp · {d.batteryKWh} kWh</div>
                          <div style={{color:'#4b5563'}}>Invest: {d.totalInvest.toLocaleString('de-DE',{maximumFractionDigits:0})} €</div>
                          <div style={{color:d.nettoErsparnis>=0?'#10b981':'#ef4444'}}>Netto: {d.nettoErsparnis.toLocaleString('de-DE',{maximumFractionDigits:0})} €/a</div>
                          <div style={{color:'#4b5563'}}>ROI: {(d.roi*100).toFixed(2)} %</div>
                          <div style={{color:'#4b5563'}}>Autarkie: {(d.autarkie*100).toFixed(1)} %</div>
                        </div>
                      );
                    }}
                  />
                  <Scatter name="Alle" data={optResult.results} fill="#d1d5db" fillOpacity={0.4} />
                  <Scatter name="Pareto" data={optResult.pareto} fill="#4b5563" fillOpacity={0.7} />
                  {optResult.strategies.map(s => s.config && (
                    <Scatter key={s.id} name={s.label} data={[s.config]} fill={s.color} shape={s.shape} />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
              <div style={{fontSize:10, color:'#6b7280', marginTop:8, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
                Geprüft: {optResult.results.length} · Effizient: {optResult.pareto.length}
              </div>
            </div>
          )}
        </div>
      </div>
      
      {optResult && !optimizing && (
        <>
          {/* Strategien · Sweet-Spot + Extreme nebeneinander auf Desktop */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 24,
            marginTop: 24,
          }}>
            <div style={styles.card}>
              <div style={styles.cardLabel}>Empfehlungen · Sweet-Spot-Methoden</div>
              <div style={{fontSize:11, color:'#4b5563', marginBottom:14, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
                Verschiedene Wege, den ausgewogenen Punkt zu bestimmen. Liegen die Empfehlungen nahe beieinander, ist die Wahl eindeutig.
              </div>
              <StrategyGrid 
                strategies={optResult.strategies.filter(s => s.group === 'pareto')}
                state={state} applyOptimum={applyOptimum} isMobile={true}
                expandedId={expandedId} setExpandedId={setExpandedId}
              />
            </div>
            
            <div style={styles.card}>
              <div style={styles.cardLabel}>Empfehlungen · Extreme</div>
              <div style={{fontSize:11, color:'#4b5563', marginBottom:14, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
                Anlagen, die einen einzelnen Aspekt maximieren. Selten die beste Gesamtwahl, aber gut zur Einordnung.
              </div>
              <StrategyGrid 
                strategies={optResult.strategies.filter(s => s.group === 'extrem')}
                state={state} applyOptimum={applyOptimum} isMobile={true}
                expandedId={expandedId} setExpandedId={setExpandedId}
              />
            </div>
          </div>
          
          {/* Marginal-ROI-Kurve */}
          <div style={{...styles.card, marginTop:24}}>
            <div style={styles.cardLabel}>Zusatzrendite · Was bringt jeder weitere Euro?</div>
            <div style={{fontSize:11, color:'#4b5563', marginBottom:12, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
              Wenn die Kurve unter die gestrichelte Linie (Vergleichszins) fällt, lohnt sich jeder weitere Euro nicht mehr im Vergleich zur Alternativanlage.
            </div>
            <ResponsiveContainer width="100%" height={isMobile ? 240 : 300}>
              <LineChart data={optResult.marginalCurve} margin={{top:10,right:10,left:0,bottom:30}}>
                <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
                <XAxis dataKey="totalInvest" tick={{fill:'#6b7280', fontSize:10}}
                  label={{value:'Kumulierte Investition [EUR]', position:'insideBottom', offset:-15, fill:'#6b7280', fontSize:11}}/>
                <YAxis tick={{fill:'#6b7280', fontSize:10}}
                  tickFormatter={v=>`${(v*100).toFixed(0)}%`}
                  label={{value:'Zusatzrendite', angle:-90, position:'insideLeft', fill:'#6b7280', fontSize:11}}/>
                <Tooltip
                  content={({active, payload}) => {
                    if (!active || !payload || !payload[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div style={{background:'#ffffff', border:'1px solid #e5e7eb', padding:'8px 10px', fontFamily:'Arial, sans-serif', fontSize:11}}>
                        <div style={{color:'#111827', marginBottom:4, fontWeight:700}}>{d.kwp} kWp · {d.batteryKWh} kWh</div>
                        <div style={{color:'#4b5563'}}>+{d.deltaInvest.toFixed(0)} € Mehr-Invest → +{d.deltaCashflow.toFixed(0)} €/a Mehr-Ersparnis</div>
                        <div style={{color: d.marginalROI >= state.optMinROI ? '#10b981' : '#ef4444'}}>Zusatzrendite: {(d.marginalROI*100).toFixed(2)} %</div>
                      </div>
                    );
                  }}
                />
                <Line type="stepAfter" dataKey={() => state.optMinROI} stroke="#ef4444" strokeDasharray="4 4" dot={false} name="Vergleichszins" />
                <Line type="monotone" dataKey="marginalROI" stroke="#22d3ee" strokeWidth={2} dot={{r:3, fill:'#22d3ee'}} name="Zusatzrendite" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}

function StrategyGrid({strategies, state, applyOptimum, isMobile, expandedId, setExpandedId}) {
  return (
    <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap:10}}>
      {strategies.map(s => {
        const c = s.config;
        const expanded = expandedId === s.id;
        if (!c || !isFinite(c.roi)) {
          return (
            <div key={s.id} style={{padding:12, background:'#f9fafb', border:'1px solid #e5e7eb', borderLeft:`3px solid ${s.color}`, fontFamily:'Arial, sans-serif', fontSize:11, color:'#6b7280'}}>
              <div style={{display:'flex', alignItems:'center', gap:8, marginBottom:4}}>
                <span style={{color: s.color, fontSize:14}}>{shapeIcon(s.shape)}</span>
                <span style={{color: s.color, letterSpacing:'0.05em'}}>{s.label}</span>
              </div>
              <div style={{fontSize:10, fontStyle:'italic'}}>Keine Loesung im Rahmen</div>
            </div>
          );
        }
        return (
          <div key={s.id} style={{padding:12, background:'#f9fafb', border:'1px solid #e5e7eb', borderLeft:`3px solid ${s.color}`}}>
            <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:8, marginBottom:8}}>
              <div style={{display:'flex', alignItems:'center', gap:8}}>
                <span style={{color: s.color, fontSize:14}}>{shapeIcon(s.shape)}</span>
                <span style={{color: s.color, fontFamily:'Arial, sans-serif', fontSize:11, letterSpacing:'0.05em', fontWeight:600}}>{s.label}</span>
              </div>
              <button
                onClick={()=>setExpandedId(expanded ? null : s.id)}
                style={{background:'transparent', border:'none', color:'#6b7280', fontFamily:'Arial, sans-serif', fontSize:10, cursor:'pointer', padding:'2px 6px'}}
              >
                {expanded ? '▲' : '?'}
              </button>
            </div>
            
            <div style={{fontSize:10, color:'#4b5563', fontFamily:'Arial, sans-serif', marginBottom:10, lineHeight:1.4}}>
              {s.desc}
            </div>
            
            {expanded && (
              <div style={{padding:10, background:'#ffffff', border:'1px solid #e5e7eb', marginBottom:10, fontSize:10, color:'#4b5563', fontFamily:'Arial, sans-serif', lineHeight:1.6}}>
                {s.explainer}
              </div>
            )}
            
            <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:6, fontSize:11, fontFamily:'Arial, sans-serif', marginBottom:10}}>
              <div><span style={{color:'#6b7280'}}>Größe </span><span style={{color:'#1f2937'}}>{c.kwp} kWp / {c.batteryKWh} kWh</span></div>
              <div><span style={{color:'#6b7280'}}>Investition </span><span style={{color:'#1f2937'}}>{(c.totalInvest/1000).toFixed(1)} k€</span></div>
              <div><span style={{color:'#6b7280'}}>Ersparnis </span><span style={{color: c.nettoErsparnis >= 0 ? '#10b981' : '#ef4444'}}>{c.nettoErsparnis.toFixed(0)} €/a</span></div>
              <div><span style={{color:'#6b7280'}}>Rendite </span><span style={{color: c.roi >= state.optMinROI ? '#10b981' : '#ef4444'}}>{(c.roi*100).toFixed(2)} %</span></div>
              <div><span style={{color:'#6b7280'}}>Autarkie </span><span style={{color:'#1f2937'}}>{(c.autarkie*100).toFixed(1)} %</span></div>
              <div><span style={{color:'#6b7280'}}>Amortisation </span><span style={{color:'#1f2937'}}>{isFinite(c.amortisation) ? `${c.amortisation.toFixed(1)} a` : '—'}</span></div>
            </div>
            
            <button onClick={()=>applyOptimum(c)} style={{...styles.applyBtn, borderColor: s.color, color: s.color, width:'100%', fontSize:10, padding:'7px'}}>
              ÜBERNEHMEN ▶
            </button>
          </div>
        );
      })}
    </div>
  );
}

function shapeIcon(shape) {
  switch(shape) {
    case 'diamond': return '◆';
    case 'triangle': return '▲';
    case 'square': return '■';
    case 'cross': return '✕';
    case 'star': return '★';
    case 'wye': return '✱';
    case 'circle': return '●';
    default: return '●';
  }
}

function RangeSlider({label, minValue, maxValue, min, max, step, unit, decimals=0, onMinChange, onMaxChange, hint}) {
  // Range Slider mit zwei Inputs
  const handleMinChange = (e) => {
    const v = parseFloat(e.target.value);
    if (v <= maxValue) onMinChange(v);
    else onMinChange(maxValue);
  };
  const handleMaxChange = (e) => {
    const v = parseFloat(e.target.value);
    if (v >= minValue) onMaxChange(v);
    else onMaxChange(minValue);
  };
  
  const fmt = (v) => decimals > 0 ? v.toFixed(decimals) : Math.round(v).toLocaleString('de-DE');
  const pct = (max - min) > 0 ? {
    left: ((minValue - min) / (max - min)) * 100,
    right: 100 - ((maxValue - min) / (max - min)) * 100,
  } : {left: 0, right: 0};
  
  return (
    <div style={{marginBottom: 18}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6, gap:8}}>
        <span style={{color:'#4b5563', fontSize:13, letterSpacing:'0.02em'}}>{label}</span>
        <span style={{color:'#111827', fontFamily:'Arial, sans-serif', fontSize:13, fontWeight:600, whiteSpace:'nowrap'}}>
          {fmt(minValue)} <span style={{color:'#6b7280'}}>—</span> {fmt(maxValue)} <span style={{color:'#6b7280', fontSize:11}}>{unit}</span>
        </span>
      </div>
      <div style={{position:'relative', height:24, marginBottom:4}}>
        {/* Track */}
        <div style={{position:'absolute', top:10, left:0, right:0, height:4, background:'#e5e7eb'}} />
        {/* Active range */}
        <div style={{position:'absolute', top:10, left:`${pct.left}%`, right:`${pct.right}%`, height:4, background:'#22d3ee'}} />
        {/* Min thumb */}
        <input type="range" min={min} max={max} step={step} value={minValue} onChange={handleMinChange}
          style={{...styles.rangeAbsolute, zIndex: minValue > max - (max-min)*0.1 ? 5 : 3}}/>
        {/* Max thumb */}
        <input type="range" min={min} max={max} step={step} value={maxValue} onChange={handleMaxChange}
          style={{...styles.rangeAbsolute, zIndex: 4}}/>
      </div>
      {hint && <div style={{fontSize:10, color:'#9ca3af', marginTop:4, fontFamily:'Arial, sans-serif'}}>{hint}</div>}
    </div>
  );
}

function KpiSmall({label, value, accent}) {
  return (
    <div style={{padding:8, background:'#f9fafb', border:'1px solid #e5e7eb'}}>
      <div style={{fontSize:9, color:'#6b7280', letterSpacing:'0.1em', textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:13, color: accent || '#111827', fontFamily:'Arial, sans-serif', fontWeight:600, marginTop:2}}>{value}</div>
    </div>
  );
}

function PersistentKpiBar({sim, isMobile}) {
  const kpis = [
    {
      label: 'Autarkie',
      value: `${(sim.autarkie*100).toFixed(1)} %`,
      accent: '#22d3ee',
      tooltip: 'Anteil deines Stromverbrauchs, der durch eigene PV+Speicher gedeckt wird. 100% wäre vollständige Unabhängigkeit vom Netz.',
    },
    {
      label: 'Eigenverbrauch',
      value: `${(sim.eigenverbrauchsquote*100).toFixed(1)} %`,
      accent: '#fbbf24',
      tooltip: 'Anteil deiner PV-Erzeugung, den du selbst nutzt (statt einzuspeisen). Je höher, desto wirtschaftlicher die Anlage bei niedriger Einspeisevergütung.',
    },
    {
      label: 'Ersparnis pro Jahr',
      value: `${sim.nettoErsparnis.toLocaleString('de-DE',{maximumFractionDigits:0})} €`,
      accent: sim.nettoErsparnis >= 0 ? '#10b981' : '#ef4444',
      tooltip: 'Was du jährlich sparst nach Abzug aller Kapital- und Betriebskosten. Bei positivem Wert lohnt sich die Anlage. Bei negativem zahlst du drauf gegenüber dem reinen Netzbezug.',
    },
    {
      label: 'dein Strompreis',
      value: `${(sim.lcoeEigenverbrauch*100).toFixed(1)} ct`,
      accent: '#a78bfa',
      tooltip: 'Was eine selbst genutzte kWh aus deiner PV+Speicher-Anlage effektiv kostet (alle Kapitalkosten verrechnet auf den Eigenverbrauch). Liegt dieser Wert unter dem Netzstrompreis, lohnt sich der Eigenverbrauch.',
    },
    {
      label: 'Eigenerzeugung',
      value: `${sim.totalPV.toLocaleString('de-DE',{maximumFractionDigits:0})} kWh`,
      accent: '#f59e0b',
      tooltip: 'Gesamte PV-Jahresproduktion. Setzt sich aus kWp × spezifischem Ertrag zusammen, mit realistischer Wettervariation.',
    },
    {
      label: 'Amortisation',
      value: isFinite(sim.amortisation) ? `${sim.amortisation.toFixed(1)} a` : '—',
      accent: '#f472b6',
      tooltip: 'Statische Amortisationszeit: nach wie vielen Jahren hast du die Anschaffung wieder eingespart? Vereinfacht ohne Strompreissteigerung.',
    },
  ];
  
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: isMobile ? 'repeat(2, 1fr)' : 'repeat(6, 1fr)',
      gap: 8,
      marginBottom: 24,
      padding: isMobile ? 8 : 0,
    }}>
      {kpis.map((k, i) => <KpiTile key={i} {...k} isMobile={isMobile} />)}
    </div>
  );
}

function KpiTile({label, value, accent, tooltip, isMobile}) {
  const [show, setShow] = useState(false);
  return (
    <div
      style={{
        padding: isMobile ? '10px 12px' : '14px 16px',
        background: '#ffffff',
        border: '1px solid #e5e7eb',
        borderTop: `2px solid ${accent}`,
        position: 'relative',
        cursor: 'help',
      }}
      onMouseEnter={()=>setShow(true)}
      onMouseLeave={()=>setShow(false)}
      onClick={()=>setShow(s=>!s)}
    >
      <div style={{
        fontSize: 9,
        color: '#6b7280',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        fontFamily: 'Arial, sans-serif',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
      }}>
        {label}
        <span style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 12,
          height: 12,
          borderRadius: '50%',
          border: '1px solid #d1d5db',
          color: '#9ca3af',
          fontSize: 9,
          marginLeft: 2,
        }}>?</span>
      </div>
      <div style={{
        fontSize: isMobile ? 16 : 20,
        color: '#111827',
        fontFamily: 'Arial, sans-serif',
        fontWeight: 700,
        marginTop: 4,
      }}>{value}</div>
      
      {show && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          marginTop: 4,
          background: '#1f2937',
          color: '#f9fafb',
          padding: '10px 12px',
          fontSize: 11,
          fontFamily: 'Arial, sans-serif',
          lineHeight: 1.5,
          zIndex: 100,
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
        }}>{tooltip}</div>
      )}
    </div>
  );
}

function ErgebnisPanel({sim, state, isMobile}) {
  const monthly = sim.monthly;
  const gridStyle = isMobile ? styles.gridMobile : styles.grid2;
  return (
    <div style={styles.panel}>
      <SectionTitle nr="05" title="Ergebnis & Bilanz" sub="Aktuelle Konfiguration" isMobile={isMobile} />
      
      {/* Gestaffeltes Eigenverbrauchs-Säulendiagramm */}
      <div style={{...styles.card, marginBottom:24}}>
        <div style={styles.cardLabel}>Stromherkunft pro Monat · woher kommt der verbrauchte Strom?</div>
        <div style={{fontSize:11, color:'#4b5563', marginBottom:14, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
          Jede Säule zeigt den Gesamtverbrauch des Monats, aufgeteilt nach Quelle. Die orange Linie ist die PV-Erzeugung — alles oberhalb der Säule wird ins Netz eingespeist.
        </div>
        <ResponsiveContainer width="100%" height={isMobile ? 280 : 340}>
          <ComposedChart data={monthly} margin={{top:10,right:10,left:-20,bottom:0}}>
            <CartesianGrid strokeDasharray="2 4" stroke="#e5e7eb" />
            <XAxis dataKey="month" tick={{fill:'#6b7280', fontSize:10}} />
            <YAxis tick={{fill:'#6b7280', fontSize:10}} label={{value:'kWh', angle:-90, position:'insideLeft', fill:'#6b7280', fontSize:11}} />
            <Tooltip
              content={({active, payload, label}) => {
                if (!active || !payload || !payload.length) return null;
                const d = payload[0].payload;
                return (
                  <div style={{background:'#ffffff', border:'1px solid #e5e7eb', padding:'10px 12px', fontFamily:'Arial, sans-serif', fontSize:11, lineHeight:1.6}}>
                    <div style={{color:'#22d3ee', marginBottom:6, fontSize:12}}>{label}</div>
                    <div style={{color:'#fbbf24'}}>PV direkt: {d.direktPV} kWh</div>
                    <div style={{color:'#10b981'}}>aus Speicher: {d.speicher} kWh</div>
                    <div style={{color:'#3b82f6'}}>aus Netz: {d.netz} kWh</div>
                    <div style={{borderTop:'1px solid #e5e7eb', marginTop:4, paddingTop:4, color:'#4b5563'}}>Verbrauch: {d.load} kWh</div>
                    <div style={{color:'#6b7280'}}>PV-Erzeugung: {d.pv} kWh</div>
                    <div style={{color:'#6b7280'}}>Einspeisung: {d.gridExport} kWh</div>
                  </div>
                );
              }}
            />
            <Legend wrapperStyle={{fontSize:11}} />
            <Bar dataKey="direktPV"  stackId="verbrauch" fill="#fbbf24" name="PV direkt" />
            <Bar dataKey="speicher"  stackId="verbrauch" fill="#10b981" name="aus Speicher" />
            <Bar dataKey="netz"      stackId="verbrauch" fill="#3b82f6" name="aus Netz" />
            <Line type="monotone" dataKey="pv" stroke="#f59e0b" strokeWidth={2} dot={{r:3, fill:'#f59e0b'}} name="PV-Erzeugung gesamt" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
      
      {/* Heatmaps */}
      <div style={{...styles.card, marginBottom:24}}>
        <div style={styles.cardLabel}>Jahres-Heatmaps · Stunde × Tag</div>
        <div style={{fontSize:11, color:'#4b5563', marginBottom:14, fontFamily:'Arial, sans-serif', lineHeight:1.5}}>
          Jeder Pixel ist ein 5-Tages-Mittel zu einer bestimmten Tagesstunde. Hier siehst du Tag-Nacht-Wechsel, Saisonverläufe und Wettervariabilität — und dass jeder Tag wirklich anders ist.
        </div>
        <div style={{display:'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: 20}}>
          <Heatmap data={sim.heatmapLoad}    title="Verbrauch [kW]"      colormap="last"     isMobile={isMobile} />
          <Heatmap data={sim.heatmapPV}      title="PV-Erzeugung [kW]"   colormap="pv"       isMobile={isMobile} />
          <Heatmap data={sim.heatmapImport}  title="Netzbezug [kW]"      colormap="netz"     isMobile={isMobile} />
          <Heatmap data={sim.heatmapBattery} title="Speicherstand [kWh]" colormap="speicher" isMobile={isMobile} />
        </div>
      </div>
      
      <div style={gridStyle}>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Geldflüsse pro Jahr</div>
          <Bilanz label="Stromkosten ohne PV" value={-sim.stromkostenOhnePV} />
          <Bilanz label="Stromkosten mit PV" value={-sim.stromkostenMitPV} />
          <Bilanz label="  davon Netzbezug" value={-sim.totalImport*state.strompreis} sub />
          <Bilanz label="  davon Einspeiseerlös" value={sim.totalExport*state.einspeiseverguetung} sub />
          <div style={{height:1, background:'#e5e7eb', margin:'12px 0'}} />
          <Bilanz label="Ersparnis vor Anlagekosten" value={sim.ersparnis} bold />
          <Bilanz label="abzgl. Kapitalkosten PV" value={-sim.pvAnnuity} />
          <Bilanz label="abzgl. Kapitalkosten Speicher" value={-sim.speicherAnnuity} />
          <Bilanz label="abzgl. Betriebskosten" value={-sim.betriebskosten} />
          <div style={{height:1, background:'#e5e7eb', margin:'12px 0'}} />
          <Bilanz label="ERSPARNIS PRO JAHR" value={sim.nettoErsparnis} bold accent />
        </div>
        <div style={styles.card}>
          <div style={styles.cardLabel}>Energiebilanz</div>
          <Bilanz label="Gesamtverbrauch" value={sim.totalLoad} unit="kWh" sign={false} />
          <Bilanz label="PV-Erzeugung" value={sim.totalPV} unit="kWh" sign={false} />
          <Bilanz label="Eigenverbrauch" value={sim.eigenverbrauch} unit="kWh" sign={false} />
          <Bilanz label="Netzbezug" value={sim.totalImport} unit="kWh" sign={false} />
          <Bilanz label="Netzeinspeisung" value={sim.totalExport} unit="kWh" sign={false} />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// HEATMAP-KOMPONENTE (Canvas-basiert fuer Performance)
// ============================================================
function Heatmap({data, title, colormap = 'amber', isMobile}) {
  const canvasRef = React.useRef(null);
  
  // Max-Wert fuer Normalisierung
  const maxVal = React.useMemo(() => {
    let max = 0;
    for (const d of data) if (d.value > max) max = d.value;
    return max || 1;
  }, [data]);
  
  // Anzahl Tag-Spalten
  const numDays = React.useMemo(() => {
    let max = 0;
    for (const d of data) if (d.day > max) max = d.day;
    return max + 1;
  }, [data]);
  
  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = canvas.width;
    const H = canvas.height;
    const cellW = W / numDays;
    const cellH = H / 24;
    
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);
    
    for (const d of data) {
      const intensity = d.value / maxVal;
      const color = colorFor(intensity, colormap);
      ctx.fillStyle = color;
      // Stunden gehen von oben (0h) nach unten (23h) -- intuitiver mit Mitternacht oben
      ctx.fillRect(d.day * cellW, d.hour * cellH, Math.ceil(cellW), Math.ceil(cellH));
    }
  }, [data, maxVal, numDays, colormap]);
  
  const monthLabels = ['Jan','Feb','Mär','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  // Position der Monatslabels: monatlicher Abstand
  
  return (
    <div>
      <div style={{fontSize:10, color:'#4b5563', fontFamily:'Arial, sans-serif', letterSpacing:'0.1em', textTransform:'uppercase', marginBottom:6}}>{title}</div>
      <div style={{position:'relative'}}>
        <canvas
          ref={canvasRef}
          width={isMobile ? 320 : 400}
          height={120}
          style={{width:'100%', height: isMobile ? 100 : 140, imageRendering:'pixelated', display:'block'}}
        />
        <div style={{display:'flex', justifyContent:'space-between', fontFamily:'Arial, sans-serif', fontSize:8, color:'#6b7280', marginTop:4}}>
          {monthLabels.map((m,i) => <span key={i}>{m}</span>)}
        </div>
      </div>
      <div style={{display:'flex', alignItems:'center', gap:6, marginTop:6, fontSize:9, color:'#6b7280', fontFamily:'Arial, sans-serif'}}>
        <span>0</span>
        <div style={{flex:1, height:6, background: gradientFor(colormap)}} />
        <span>{maxVal.toFixed(1)} kW</span>
      </div>
    </div>
  );
}

function colorFor(t, colormap) {
  // t in [0,1], Start = sehr hell (kaum sichtbar), Ende = Vollton der Saeule
  t = Math.max(0, Math.min(1, t));
  const palettes = {
    pv:      [[249,250,251], [251,191,36]],   // PV-direkt: orange/gelb wie #fbbf24
    speicher:[[249,250,251], [16,185,129]],   // Speicher: grün wie #10b981
    netz:    [[249,250,251], [59,130,246]],   // Netz: blau wie #3b82f6
    last:    [[249,250,251], [239,68,68]],    // Last: rot wie #ef4444
  };
  const p = palettes[colormap] || palettes.pv;
  const r = Math.round(p[0][0] + (p[1][0] - p[0][0]) * t);
  const g = Math.round(p[0][1] + (p[1][1] - p[0][1]) * t);
  const b = Math.round(p[0][2] + (p[1][2] - p[0][2]) * t);
  return `rgb(${r},${g},${b})`;
}

function gradientFor(colormap) {
  const palettes = {
    pv:      'linear-gradient(to right, #f9fafb, #fbbf24)',
    speicher:'linear-gradient(to right, #f9fafb, #10b981)',
    netz:    'linear-gradient(to right, #f9fafb, #3b82f6)',
    last:    'linear-gradient(to right, #f9fafb, #ef4444)',
  };
  return palettes[colormap] || palettes.pv;
}

function Slider({label, value, min, max, step, unit, onChange, hint, decimals=0, display}) {
  const shown = display ? display(value) : (decimals > 0 ? value.toFixed(decimals) : Math.round(value).toLocaleString('de-DE'));
  return (
    <div style={{marginBottom:18}}>
      <div style={{display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:6, gap:8}}>
        <span style={{color:'#4b5563', fontSize:13, letterSpacing:'0.02em'}}>{label}</span>
        <span style={{color:'#111827', fontFamily:'Arial, sans-serif', fontSize:14, fontWeight:600, whiteSpace:'nowrap'}}>
          {shown} <span style={{color:'#6b7280', fontSize:11}}>{unit}</span>
        </span>
      </div>
      <input type="range" min={min} max={max} step={step} value={value} onChange={e=>onChange(parseFloat(e.target.value))} style={styles.range} />
      {hint && <div style={{fontSize:10, color:'#9ca3af', marginTop:4, fontFamily:'Arial, sans-serif'}}>{hint}</div>}
    </div>
  );
}

function ToggleRow({label, value, onChange}) {
  return (
    <div style={{display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:18}}>
      <span style={{color:'#111827', fontSize:14, fontWeight:600, letterSpacing:'0.04em', textTransform:'uppercase'}}>{label}</span>
      <button onClick={()=>onChange(!value)} style={{
        background: value ? '#22d3ee' : '#e5e7eb', border: 'none',
        color: value ? '#f9fafb' : '#4b5563', padding: '6px 14px',
        fontFamily: 'Arial, sans-serif', fontSize: 11,
        letterSpacing: '0.1em', cursor: 'pointer', fontWeight: 700,
      }}>{value ? 'AKTIV' : 'AUS'}</button>
    </div>
  );
}

function SectionTitle({nr, title, sub, isMobile}) {
  return (
    <div style={{marginBottom:24}}>
      <div style={{display:'flex', alignItems:'baseline', gap:isMobile ? 10 : 16, flexWrap:'wrap'}}>
        <span style={{fontFamily:'Arial, sans-serif', color:'#22d3ee', fontSize:12, letterSpacing:'0.2em'}}>// {nr}</span>
        <h2 style={{margin:0, fontSize:isMobile ? 18 : 24, color:'#111827', fontWeight:600, letterSpacing:'-0.02em'}}>{title}</h2>
      </div>
      <div style={{color:'#6b7280', fontSize:12, marginTop:4, marginLeft: isMobile ? 0 : 38, fontFamily:'Arial, sans-serif'}}>{sub}</div>
    </div>
  );
}

function Kpi({label, value}) {
  return (
    <div style={{padding:'10px 0'}}>
      <div style={{fontSize:10, color:'#6b7280', letterSpacing:'0.1em', textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize:14, color:'#111827', fontFamily:'Arial, sans-serif', fontWeight:600, marginTop:2}}>{value}</div>
    </div>
  );
}

function KpiBig({label, value, accent, isMobile}) {
  return (
    <div style={{
      flex: isMobile ? '1 1 calc(50% - 4px)' : 1,
      minWidth: isMobile ? 'calc(50% - 4px)' : 130,
      padding: isMobile ? '12px 14px' : '18px 20px',
      background:'#ffffff', border:'1px solid #e5e7eb', borderTop:`2px solid ${accent}`
    }}>
      <div style={{fontSize:9, color:'#6b7280', letterSpacing:'0.15em', textTransform:'uppercase'}}>{label}</div>
      <div style={{fontSize: isMobile ? 16 : 22, color:'#111827', fontFamily:'Arial, sans-serif', fontWeight:700, marginTop:6}}>{value}</div>
    </div>
  );
}

function Bilanz({label, value, sub, bold, accent, unit='EUR', sign=true}) {
  const formatted = unit === 'EUR'
    ? `${sign && value >= 0 ? '+' : ''}${value.toLocaleString('de-DE',{maximumFractionDigits:0})} ${unit}`
    : `${value.toLocaleString('de-DE',{maximumFractionDigits:0})} ${unit}`;
  const color = accent ? (value >= 0 ? '#10b981' : '#ef4444') : '#111827';
  return (
    <div style={{
      display:'flex', justifyContent:'space-between',
      padding: sub ? '4px 0 4px 16px' : '6px 0',
      fontSize: sub ? 12 : 13,
      color: sub ? '#6b7280' : '#4b5563', gap: 8,
    }}>
      <span style={{fontWeight: bold ? 700 : 400, letterSpacing: bold ? '0.05em' : 'normal', textTransform: bold ? 'uppercase' : 'none'}}>{label}</span>
      <span style={{fontFamily:'Arial, sans-serif', color: bold ? color : (sub ? '#6b7280' : '#1f2937'), fontWeight: bold ? 700 : 500, whiteSpace:'nowrap'}}>{formatted}</span>
    </div>
  );
}

function aggregateDaily({load, pv, gridImport, gridExport, soc, batteryCharge, batteryDischarge, haushalt, waerme, warmwasser, ev}) {
  const result = [];
  for (let d = 0; d < 365; d++) {
    let l=0, p=0, gi=0, ge=0, bc=0, bd=0, socEnd = 0;
    let h_=0, w_=0, ww_=0, e_=0;
    for (let h = 0; h < 24; h++) {
      const i = d*24+h;
      l += load[i]; p += pv[i]; gi += gridImport[i]; ge += gridExport[i];
      bc += batteryCharge[i]; bd += batteryDischarge[i];
      if (haushalt) h_ += haushalt[i];
      if (waerme) w_ += waerme[i];
      if (warmwasser) ww_ += warmwasser[i];
      if (ev) e_ += ev[i];
      socEnd = soc[i];
    }
    result.push({
      day: d+1, load: l, pv: p, gridImport: gi, gridExport: ge,
      soc: socEnd, batteryCharge: bc, batteryDischarge: bd,
      haushalt: h_, waerme: w_, warmwasser: ww_, ev: e_,
    });
  }
  return result;
}

function extractDay({load, pv, gridImport, gridExport, soc}, dayIdx) {
  const result = [];
  for (let h = 0; h < 24; h++) {
    const i = dayIdx*24+h;
    result.push({hour: h, load: load[i], pv: pv[i], gridImport: gridImport[i], gridExport: gridExport[i], soc: soc[i]});
  }
  return result;
}

function aggregateMonthly({load, pv, gridImport, gridExport, batteryDischarge}) {
  const monthDays = [31,28,31,30,31,30,31,31,30,31,30,31];
  const monthNames = ['Jan','Feb','Mrz','Apr','Mai','Jun','Jul','Aug','Sep','Okt','Nov','Dez'];
  const result = [];
  let dayCounter = 0;
  for (let m = 0; m < 12; m++) {
    let l=0, p=0, gi=0, ge=0, bd=0;
    for (let d = 0; d < monthDays[m]; d++) {
      for (let h = 0; h < 24; h++) {
        const i = (dayCounter+d)*24+h;
        if (i < load.length) {
          l += load[i]; p += pv[i]; gi += gridImport[i]; ge += gridExport[i];
          if (batteryDischarge) bd += batteryDischarge[i];
        }
      }
    }
    dayCounter += monthDays[m];
    // Aufteilung der Last in: direkter PV-Verbrauch, Speicher-Entladung, Netzbezug
    // direkter PV = Last - Netzbezug - Speicherentladung (entspricht: PV-Erzeugung - Einspeisung - was in den Speicher floss)
    // Vereinfacht: Last = direktPV + speicher + netzbezug
    const direktPV = Math.max(0, l - gi - bd);
    result.push({
      month: monthNames[m],
      load: Math.round(l),
      pv: Math.round(p),
      gridImport: Math.round(gi),
      gridExport: Math.round(ge),
      direktPV: Math.round(direktPV),
      speicher: Math.round(bd),
      netz: Math.round(gi),
    });
  }
  return result;
}

// Heatmap-Aggregation: 365 Tage x 24 Stunden -> Matrix fuer Visualisierung
// Liefert Array von {day, hour, value} fuer Recharts-Scatter-Heatmap
function aggregateHeatmap(series, downsampleDays = 1) {
  const result = [];
  const numDays = Math.floor(365 / downsampleDays);
  for (let d = 0; d < numDays; d++) {
    for (let h = 0; h < 24; h++) {
      let sum = 0;
      let count = 0;
      for (let dd = 0; dd < downsampleDays; dd++) {
        const i = (d * downsampleDays + dd) * 24 + h;
        if (i < series.length) { sum += series[i]; count++; }
      }
      result.push({day: d, hour: h, value: count > 0 ? sum / count : 0});
    }
  }
  return result;
}

const styles = {
  container: { minHeight: '100vh', background: '#f9fafb', color: '#111827', fontFamily: 'Arial, sans-serif' },
  header: { display: 'flex', justifyContent: 'space-between', marginBottom: 28, paddingBottom: 20, borderBottom: '1px solid #e5e7eb' },
  headerLabel: { fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#22d3ee', letterSpacing: '0.3em', marginBottom: 8 },
  headerTitle: { margin: 0, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: '#111827' },
  headerSub: { color: '#6b7280', fontSize: 12, fontFamily: 'Arial, sans-serif', marginTop: 8, letterSpacing: '0.05em' },
  resetBtn: { background: 'transparent', border: '1px solid #e5e7eb', color: '#4b5563', padding: '8px 16px', fontFamily: 'Arial, sans-serif', fontSize: 11, letterSpacing: '0.15em', cursor: 'pointer', alignSelf: 'flex-start' },
  tabNav: { display: 'flex', gap: 4, marginBottom: 24, borderBottom: '1px solid #e5e7eb' },
  tabBtn: { background: 'transparent', border: 'none', color: '#6b7280', fontFamily: 'Arial, sans-serif', fontSize: 12, letterSpacing: '0.1em', cursor: 'pointer', borderBottom: '2px solid transparent' },
  tabBtnActive: { color: '#22d3ee', borderBottom: '2px solid #22d3ee' },
  main: { minHeight: 600 },
  panel: { animation: 'fadeIn 0.3s ease-out' },
  grid2: { display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 24 },
  gridMobile: { display: 'flex', flexDirection: 'column', gap: 16 },
  card: { background: '#ffffff', border: '1px solid #e5e7eb', padding: 20 },
  cardLabel: { fontFamily: 'Arial, sans-serif', fontSize: 11, color: '#6b7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginBottom: 16 },
  totalRow: { display: 'flex', justifyContent: 'space-between', paddingTop: 16, marginTop: 16, borderTop: '1px solid #e5e7eb', fontSize: 14, color: '#22d3ee', fontFamily: 'Arial, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em' },
  infoRow: { display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontSize: 12, color: '#4b5563', fontFamily: 'Arial, sans-serif' },
  range: { width: '100%', accentColor: '#22d3ee', background: 'transparent' },
  rangeAbsolute: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: '100%',
    height: 24,
    background: 'transparent',
    pointerEvents: 'none',
    appearance: 'none',
    WebkitAppearance: 'none',
    margin: 0,
    padding: 0,
  },
  summaryGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 },
  kpiBar: { display: 'flex', gap: 12, marginBottom: 24 },
  footer: { display: 'flex', justifyContent: 'space-between', marginTop: 32, paddingTop: 16, borderTop: '1px solid #e5e7eb', fontFamily: 'Arial, sans-serif', color: '#9ca3af', letterSpacing: '0.1em', textTransform: 'uppercase' },
  optimizeBtn: { width: '100%', background: '#22d3ee', border: 'none', color: '#f9fafb', padding: '14px 20px', fontFamily: 'Arial, sans-serif', fontSize: 12, letterSpacing: '0.2em', cursor: 'pointer', fontWeight: 700 },
  applyBtn: { background: 'transparent', border: '1px solid', padding: '6px 12px', fontFamily: 'Arial, sans-serif', fontSize: 10, letterSpacing: '0.15em', cursor: 'pointer', fontWeight: 700 },
};

const globalCss = `
  * { box-sizing: border-box; }
  body { margin: 0; background: #f9fafb; }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
  input[type="range"] {
    -webkit-appearance: none;
    height: 4px;
    background: #e5e7eb;
    outline: none;
    cursor: pointer;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 18px; height: 18px;
    background: #22d3ee;
    cursor: pointer;
    border-radius: 0;
    pointer-events: auto;
  }
  input[type="range"]::-moz-range-thumb {
    width: 18px; height: 18px;
    background: #22d3ee;
    cursor: pointer;
    border: none;
    border-radius: 0;
    pointer-events: auto;
  }
  /* Range-Slider innerhalb von Doppel-Slider: Track unsichtbar */
  input[type="range"][style*="position: absolute"]::-webkit-slider-runnable-track {
    background: transparent;
    border: none;
  }
  input[type="range"][style*="position: absolute"]::-moz-range-track {
    background: transparent;
    border: none;
  }
  input[type="range"][style*="position: absolute"] {
    background: transparent !important;
  }
  button:hover { opacity: 0.85; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
`;
