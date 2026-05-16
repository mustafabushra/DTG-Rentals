/**
 * Backup & Recovery Console
 * Export: JSON download / Share
 * Import: File upload OR paste JSON — with validation, auto-repair, diff preview, confirm
 */
import React, {
  useCallback, useEffect, useRef, useState,
} from 'react';
import {
  ActivityIndicator, Animated, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Theme } from '../constants/Theme';
import { AppHeader } from '../components/ui/AppHeader';
import { useApp } from '../context/AppProvider';
import { FormContainer } from '../components/ui/FormContainer';
import {
  BackupPayload, DiffSummary, ValidationResult, ValidationStatus,
  buildDiff, validateBackup,
} from '../lib/backupValidator';
import { useAppTheme } from '../hooks/useAppTheme';

// ─── Types ────────────────────────────────────────────────────────────────────
type ImportTab  = 'file' | 'paste';
type ImportStep = 'input' | 'preview' | 'confirming' | 'success' | 'error';

// ─── Colour shortcuts ─────────────────────────────────────────────────────────
const STATUS_COLOR: Record<ValidationStatus, string> = {
  idle:    '#555',
  valid:   '#27AE60',
  warning: '#F39C12',
  error:   '#E74C3C',
};
const STATUS_ICON: Record<ValidationStatus, string> = {
  idle:    'ellipse-outline',
  valid:   'checkmark-circle',
  warning: 'warning',
  error:   'close-circle',
};
const STATUS_LABEL: Record<ValidationStatus, string> = {
  idle:    'في انتظار البيانات',
  valid:   'البيانات صالحة للاستعادة',
  warning: 'صالح مع تحذيرات',
  error:   'خطأ في البيانات',
};

// ─── Main screen ──────────────────────────────────────────────────────────────
export default function BackupScreen() {
  const { colors } = useAppTheme();
  const {
    owners, properties, units, tenants, contracts, payments, maintenance,
    attachments, importBackup,
  } = useApp();

  const [activeSection, setActiveSection] = useState<'export' | 'import'>('export');

  // Export state
  const [exporting, setExporting] = useState(false);
  const [lastBackup, setLastBackup] = useState<string | null>(null);

  const buildBackupJson = (): BackupPayload => ({
    exportedAt: new Date().toISOString(),
    version:    '1.0',
    summary: {
      owners: owners.length, properties: properties.length,
      units:  units.length,  tenants:    tenants.length,
      contracts: contracts.length, payments: payments.length,
      maintenance: maintenance.length, attachments: attachments.length,
    },
    data: { owners, properties, units, tenants, contracts, payments, maintenance },
  });

  const handleExport = async () => {
    setExporting(true);
    try {
      await new Promise(r => setTimeout(r, 400));
      const json = JSON.stringify(buildBackupJson(), null, 2);
      const filename = `DTG_Backup_${new Date().toISOString().split('T')[0]}.json`;

      if (Platform.OS === 'web') {
        const blob = new Blob([json], { type: 'application/json' });
        const url  = URL.createObjectURL(blob);
        const a    = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
      } else {
        const { Share } = await import('react-native');
        await Share.share({ message: json, title: filename });
      }
      setLastBackup(new Date().toLocaleString('ar-SA'));
    } catch { /* user cancelled */ } finally { setExporting(false); }
  };

  const stats = [
    { label: 'الملاك',      value: owners.length,      icon: 'person-outline',        color: '#8E44AD' },
    { label: 'العقارات',    value: properties.length,   icon: 'business-outline',      color: colors.primary },
    { label: 'الوحدات',     value: units.length,        icon: 'home-outline',          color: colors.secondary },
    { label: 'المستأجرون',  value: tenants.length,      icon: 'people-outline',        color: '#F39C12' },
    { label: 'العقود',      value: contracts.length,    icon: 'document-text-outline', color: colors.success },
    { label: 'الدفعات',     value: payments.length,     icon: 'cash-outline',          color: '#27AE60' },
    { label: 'الصيانة',     value: maintenance.length,  icon: 'construct-outline',     color: colors.warning },
    { label: 'المرفقات',    value: attachments.length,  icon: 'attach-outline',        color: colors.textSecondary },
  ];

  const currentData = { owners, properties, units, tenants, contracts, payments, maintenance };

  return (
    <View style={[s.container, { backgroundColor: colors.background }]}>
      <AppHeader title="النسخ الاحتياطي والاستعادة" />

      {/* Section Tabs */}
      <View style={[s.sectionTabs, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        {(['export', 'import'] as const).map(sec => (
          <TouchableOpacity
            key={sec}
            style={[s.sectionTab, activeSection === sec && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
            onPress={() => setActiveSection(sec)}
          >
            <Ionicons
              name={sec === 'export' ? 'cloud-upload-outline' : 'cloud-download-outline'}
              size={18}
              color={activeSection === sec ? colors.primary : colors.textMuted}
            />
            <Text style={[s.sectionTabText, { color: activeSection === sec ? colors.primary : colors.textMuted }]}>
              {sec === 'export' ? 'تصدير نسخة' : 'استعادة نسخة'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FormContainer>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 56 }}>
          {activeSection === 'export'
            ? <ExportSection colors={colors} stats={stats} exporting={exporting} lastBackup={lastBackup} onExport={handleExport} />
            : <RecoveryConsole colors={colors} currentData={currentData} onImport={importBackup} />
          }
        </ScrollView>
      </FormContainer>
    </View>
  );
}

// ─── Export section (existing, lightly polished) ──────────────────────────────
function ExportSection({ colors, stats, exporting, lastBackup, onExport }: any) {
  return (
    <>
      <View style={[s.statusCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={[s.statusIcon, { backgroundColor: lastBackup ? colors.successSubtle : colors.warningSubtle }]}>
          <Ionicons
            name={lastBackup ? 'cloud-done-outline' : 'cloud-offline-outline'}
            size={36}
            color={lastBackup ? colors.success : colors.warning}
          />
        </View>
        <Text style={[s.statusTitle, { color: colors.text }]}>
          {lastBackup ? 'آخر نسخة احتياطية' : 'لا توجد نسخة احتياطية'}
        </Text>
        <Text style={[s.statusSub, { color: colors.textMuted }]}>
          {lastBackup ?? 'لم يتم إجراء نسخ احتياطي في هذه الجلسة'}
        </Text>
      </View>

      <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[s.sectionTitle, { color: colors.text }]}>محتوى النسخة الاحتياطية</Text>
        <View style={s.statsGrid}>
          {stats.map((st: any) => (
            <View key={st.label} style={[s.statCell, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <Ionicons name={st.icon} size={20} color={st.color} />
              <Text style={[s.statVal, { color: st.color }]}>{st.value}</Text>
              <Text style={[s.statLbl, { color: colors.textMuted }]}>{st.label}</Text>
            </View>
          ))}
        </View>
      </View>

      <TouchableOpacity
        style={[s.exportBtn, { backgroundColor: exporting ? colors.border : colors.primary }]}
        onPress={onExport}
        disabled={exporting}
        activeOpacity={0.85}
      >
        <Ionicons name={exporting ? 'hourglass-outline' : 'cloud-upload-outline'} size={22} color="#FFF" />
        <Text style={s.exportBtnText}>{exporting ? 'جارٍ التصدير…' : 'تصدير وتنزيل النسخة الاحتياطية'}</Text>
      </TouchableOpacity>
    </>
  );
}

// ─── Recovery Console ─────────────────────────────────────────────────────────
function RecoveryConsole({ colors, currentData, onImport }: {
  colors: any;
  currentData: Record<string, any[]>;
  onImport: (payload: BackupPayload) => Promise<void>;
}) {
  const [tab,         setTab]         = useState<ImportTab>('file');
  const [step,        setStep]        = useState<ImportStep>('input');
  const [pasteText,   setPasteText]   = useState('');
  const [validation,  setValidation]  = useState<ValidationResult | null>(null);
  const [diff,        setDiff]        = useState<DiffSummary[]>([]);
  const [confirmed,   setConfirmed]   = useState(false);
  const [importing,   setImporting]   = useState(false);
  const [rollback,    setRollback]    = useState<BackupPayload | null>(null);
  const [fileName,    setFileName]    = useState<string | null>(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const debounceRef = useRef<any>(null);

  // Status pill animation
  const pillScale = useRef(new Animated.Value(1)).current;
  const animatePill = () => {
    Animated.sequence([
      Animated.timing(pillScale, { toValue: 1.06, duration: 120, useNativeDriver: true }),
      Animated.timing(pillScale, { toValue: 1,    duration: 120, useNativeDriver: true }),
    ]).start();
  };

  // ── File picker ──
  const pickFile = useCallback(() => {
    if (Platform.OS === 'web') {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json,text/plain';
      input.onchange = async (e: any) => {
        const file: File = e.target.files?.[0];
        if (!file) return;
        setFileName(file.name);
        const text = await file.text();
        runValidation(text);
      };
      input.click();
    } else {
      import('expo-document-picker').then(({ getDocumentAsync }) => {
        getDocumentAsync({ type: ['application/json', 'text/plain'], copyToCacheDirectory: true })
          .then(async res => {
            if (res.canceled) return;
            const asset = res.assets?.[0];
            if (!asset) return;
            setFileName(asset.name);
            const resp = await fetch(asset.uri);
            const text = await resp.text();
            runValidation(text);
          });
      });
    }
  }, []);

  // ── Paste real-time debounce ──
  useEffect(() => {
    if (tab !== 'paste' || !pasteText.trim()) {
      setValidation(null);
      return;
    }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runValidation(pasteText), 500);
    return () => clearTimeout(debounceRef.current);
  }, [pasteText, tab]);

  const runValidation = (raw: string) => {
    const result = validateBackup(raw);
    setValidation(result);
    animatePill();
    if (result.parsed) {
      setDiff(buildDiff(currentData, result.parsed));
    }
  };

  const handleRestore = async () => {
    if (!validation?.parsed) return;
    setImporting(true);
    // Save rollback snapshot
    const snap: BackupPayload = {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      summary: {},
      data: {
        owners:      currentData.owners      ?? [],
        properties:  currentData.properties  ?? [],
        units:       currentData.units       ?? [],
        tenants:     currentData.tenants     ?? [],
        contracts:   currentData.contracts   ?? [],
        payments:    currentData.payments    ?? [],
        maintenance: currentData.maintenance ?? [],
      },
    };
    setRollback(snap);
    try {
      await onImport(validation.parsed);
      setStep('success');
    } catch (e: any) {
      setErrorMsg(e?.message ?? 'حدث خطأ غير متوقع أثناء الاستعادة');
      setStep('error');
    } finally {
      setImporting(false);
    }
  };

  const handleRollback = async () => {
    if (!rollback) return;
    setImporting(true);
    try {
      await onImport(rollback);
      setStep('input');
      setValidation(null);
      setPasteText('');
      setFileName(null);
      setRollback(null);
      setConfirmed(false);
    } finally { setImporting(false); }
  };

  const reset = () => {
    setStep('input');
    setValidation(null);
    setPasteText('');
    setFileName(null);
    setConfirmed(false);
    setErrorMsg('');
  };

  // ── Success ──
  if (step === 'success') {
    return <SuccessPanel colors={colors} diff={diff} onRollback={rollback ? handleRollback : undefined} onDone={reset} importing={importing} />;
  }
  if (step === 'error') {
    return <ErrorPanel colors={colors} message={errorMsg} onRetry={reset} />;
  }

  const statusColor = validation ? STATUS_COLOR[validation.status] : colors.textMuted;
  const canAdvance  = validation?.status === 'valid' || validation?.status === 'warning';

  return (
    <View style={{ gap: 14, paddingTop: 4 }}>

      {/* ── Recovery Console header ── */}
      <View style={[s.consoleHeader, { backgroundColor: '#021C36' }]}>
        <Ionicons name="terminal-outline" size={18} color="#C3AF76" />
        <Text style={s.consoleTitle}>وحدة الاستعادة</Text>
        <Animated.View style={[s.statusPill, { backgroundColor: statusColor + '22', borderColor: statusColor, transform: [{ scale: pillScale }] }]}>
          <Ionicons name={(STATUS_ICON[validation?.status ?? 'idle']) as any} size={13} color={statusColor} />
          <Text style={[s.statusPillText, { color: statusColor }]}>
            {STATUS_LABEL[validation?.status ?? 'idle']}
          </Text>
        </Animated.View>
      </View>

      {/* ── Input tabs ── */}
      <View style={[s.tabBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
        {(['file', 'paste'] as const).map(t => (
          <TouchableOpacity key={t} style={[s.tabBtn, tab === t && { backgroundColor: colors.primarySubtle }]} onPress={() => { setTab(t); setValidation(null); }}>
            <Ionicons name={t === 'file' ? 'document-outline' : 'clipboard-outline'} size={16} color={tab === t ? colors.primary : colors.textMuted} />
            <Text style={[s.tabText, { color: tab === t ? colors.primary : colors.textMuted }]}>
              {t === 'file' ? 'رفع ملف' : 'لصق JSON'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* ── File upload panel ── */}
      {tab === 'file' && (
        <FileUploadPanel
          colors={colors}
          fileName={fileName}
          validation={validation}
          onPick={pickFile}
          onSwitchToPaste={() => setTab('paste')}
        />
      )}

      {/* ── Paste panel ── */}
      {tab === 'paste' && (
        <PastePanel
          colors={colors}
          value={pasteText}
          onChange={setPasteText}
          validation={validation}
        />
      )}

      {/* ── Validation panel ── */}
      {validation && (
        <ValidationPanel colors={colors} result={validation} />
      )}

      {/* ── Diff preview ── */}
      {canAdvance && diff.length > 0 && (
        <DiffPanel colors={colors} diff={diff} />
      )}

      {/* ── Confirm ── */}
      {canAdvance && (
        <ConfirmPanel
          colors={colors}
          confirmed={confirmed}
          importing={importing}
          onToggle={() => setConfirmed(p => !p)}
          onRestore={handleRestore}
        />
      )}
    </View>
  );
}

// ─── File Upload Panel ────────────────────────────────────────────────────────
function FileUploadPanel({ colors, fileName, validation, onPick, onSwitchToPaste }: any) {
  return (
    <View style={{ gap: 10 }}>
      <TouchableOpacity
        style={[s.dropZone, {
          backgroundColor: colors.surface,
          borderColor: validation?.status === 'valid'   ? '#27AE60'
                     : validation?.status === 'error'   ? '#E74C3C'
                     : validation?.status === 'warning' ? '#F39C12'
                     : colors.border,
        }]}
        onPress={onPick}
        activeOpacity={0.8}
      >
        <View style={[s.dropIconCircle, { backgroundColor: colors.primarySubtle }]}>
          <Ionicons name={fileName ? 'document-text' : 'cloud-upload-outline'} size={32} color={colors.primary} />
        </View>
        <Text style={[s.dropTitle, { color: colors.text }]}>
          {fileName ?? 'اضغط لاختيار ملف JSON'}
        </Text>
        <Text style={[s.dropSub, { color: colors.textMuted }]}>
          {fileName ? 'اضغط لتغيير الملف' : 'يقبل: .json — الحجم الأقصى 10 MB'}
        </Text>
      </TouchableOpacity>

      <View style={[s.fallbackRow, { borderColor: colors.border }]}>
        <Ionicons name="information-circle-outline" size={15} color={colors.textMuted} />
        <Text style={[s.fallbackText, { color: colors.textMuted }]}>لا يعمل رفع الملف؟ </Text>
        <TouchableOpacity onPress={onSwitchToPaste}>
          <Text style={[s.fallbackLink, { color: colors.primary }]}>الصق JSON مباشرة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Paste Panel ──────────────────────────────────────────────────────────────
function PastePanel({ colors, value, onChange, validation }: any) {
  const borderColor = validation?.status === 'valid'   ? '#27AE60'
                    : validation?.status === 'error'   ? '#E74C3C'
                    : validation?.status === 'warning' ? '#F39C12'
                    : colors.border;
  return (
    <View style={{ gap: 8 }}>
      <View style={[s.pasteWrap, { borderColor, backgroundColor: colors.surface }]}>
        <TextInput
          style={[s.pasteInput, { color: colors.text, fontFamily: Platform.OS === 'web' ? 'monospace' : 'Courier' }]}
          value={value}
          onChangeText={onChange}
          placeholder={'{\n  "version": "1.0",\n  "data": { ... }\n}'}
          placeholderTextColor={colors.textMuted}
          multiline
          textAlignVertical="top"
          autoCorrect={false}
          autoCapitalize="none"
          spellCheck={false}
        />
      </View>
      {value.length > 0 && (
        <TouchableOpacity style={s.clearBtn} onPress={() => onChange('')}>
          <Ionicons name="trash-outline" size={14} color={colors.textMuted} />
          <Text style={[s.clearText, { color: colors.textMuted }]}>مسح</Text>
        </TouchableOpacity>
      )}
      <Text style={[s.charCount, { color: colors.textMuted }]}>
        {value.length.toLocaleString('ar')} حرف
        {value.length > 0 && ` · التحقق تلقائياً خلال ثانية`}
      </Text>
    </View>
  );
}

// ─── Validation Panel ─────────────────────────────────────────────────────────
function ValidationPanel({ colors, result }: { colors: any; result: ValidationResult }) {
  const statusColor = STATUS_COLOR[result.status];
  return (
    <View style={[s.validPanel, { backgroundColor: statusColor + '12', borderColor: statusColor + '44' }]}>
      <View style={s.validHeader}>
        <Ionicons name={STATUS_ICON[result.status] as any} size={18} color={statusColor} />
        <Text style={[s.validHeaderText, { color: statusColor }]}>
          {STATUS_LABEL[result.status]}
        </Text>
        {result.repaired && (
          <View style={[s.repairedBadge, { backgroundColor: '#F39C1222', borderColor: '#F39C12' }]}>
            <Ionicons name="construct-outline" size={11} color="#F39C12" />
            <Text style={s.repairedText}>تم الإصلاح التلقائي</Text>
          </View>
        )}
      </View>

      {result.errors.length > 0 && (
        <View style={{ gap: 4, marginTop: 8 }}>
          {result.errors.map((e, i) => (
            <View key={i} style={s.msgRow}>
              <Ionicons name="close-circle-outline" size={14} color="#E74C3C" />
              <Text style={[s.msgText, { color: '#E74C3C' }]}>{e}</Text>
            </View>
          ))}
        </View>
      )}
      {result.warnings.length > 0 && (
        <View style={{ gap: 4, marginTop: 6 }}>
          {result.warnings.map((w, i) => (
            <View key={i} style={s.msgRow}>
              <Ionicons name="warning-outline" size={14} color="#F39C12" />
              <Text style={[s.msgText, { color: '#F39C12' }]}>{w}</Text>
            </View>
          ))}
        </View>
      )}

      {result.parsed && (
        <View style={[s.countsRow, { borderTopColor: statusColor + '33' }]}>
          {Object.entries(result.counts).map(([col, n]) => (
            <View key={col} style={s.countChip}>
              <Text style={[s.countNum, { color: statusColor }]}>{n}</Text>
              <Text style={[s.countCol, { color: colors.textMuted }]}>{col === 'owners' ? 'ملاك' : col === 'properties' ? 'عقارات' : col === 'units' ? 'وحدات' : col === 'tenants' ? 'مستأجرون' : col === 'contracts' ? 'عقود' : col === 'payments' ? 'دفعات' : 'صيانة'}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

// ─── Diff Panel ───────────────────────────────────────────────────────────────
function DiffPanel({ colors, diff }: { colors: any; diff: DiffSummary[] }) {
  return (
    <View style={[s.section, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Text style={[s.sectionTitle, { color: colors.text }]}>معاينة التغييرات</Text>
      <View style={s.diffHeaderRow}>
        <Text style={[s.diffColLabel, { color: colors.textMuted, flex: 2 }]}>المجموعة</Text>
        <Text style={[s.diffColLabel, { color: colors.textMuted }]}>الحالي</Text>
        <Text style={[s.diffColLabel, { color: colors.textMuted }]}>الجديد</Text>
        <Text style={[s.diffColLabel, { color: colors.textMuted }]}>الفرق</Text>
      </View>
      {diff.map(d => (
        <View key={d.col} style={[s.diffRow, { borderBottomColor: colors.border }]}>
          <Text style={[s.diffLabel, { color: colors.text, flex: 2 }]}>{d.label}</Text>
          <Text style={[s.diffNum, { color: colors.textMuted }]}>{d.current}</Text>
          <Text style={[s.diffNum, { color: colors.text, fontWeight: '700' }]}>{d.incoming}</Text>
          <Text style={[s.diffDelta, { color: d.delta > 0 ? '#27AE60' : d.delta < 0 ? '#E74C3C' : colors.textMuted }]}>
            {d.delta > 0 ? `+${d.delta}` : d.delta === 0 ? '—' : `${d.delta}`}
          </Text>
        </View>
      ))}
      <View style={[s.diffWarning, { backgroundColor: '#E74C3C12', borderColor: '#E74C3C33' }]}>
        <Ionicons name="alert-circle-outline" size={15} color="#E74C3C" />
        <Text style={[s.diffWarningText, { color: '#E74C3C' }]}>
          سيتم استبدال جميع البيانات الحالية بالبيانات المستعادة
        </Text>
      </View>
    </View>
  );
}

// ─── Confirm Panel ────────────────────────────────────────────────────────────
function ConfirmPanel({ colors, confirmed, importing, onToggle, onRestore }: any) {
  return (
    <View style={{ gap: 12 }}>
      <TouchableOpacity style={[s.checkRow, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={onToggle}>
        <View style={[s.checkbox, { borderColor: confirmed ? '#27AE60' : colors.border, backgroundColor: confirmed ? '#27AE60' : 'transparent' }]}>
          {confirmed && <Ionicons name="checkmark" size={14} color="#FFF" />}
        </View>
        <Text style={[s.checkText, { color: colors.textSecondary }]}>
          أفهم أن البيانات الحالية ستُستبدل بالكامل ولا يمكن التراجع تلقائياً إلا من خلال زر الرجوع
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[s.restoreBtn, (!confirmed || importing) && { opacity: 0.4 }]}
        onPress={onRestore}
        disabled={!confirmed || importing}
        activeOpacity={0.85}
      >
        {importing
          ? <ActivityIndicator color="#FFF" size="small" />
          : <Ionicons name="refresh-circle-outline" size={22} color="#FFF" />
        }
        <Text style={s.restoreBtnText}>{importing ? 'جارٍ الاستعادة…' : 'استعادة البيانات الآن'}</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Success Panel ────────────────────────────────────────────────────────────
function SuccessPanel({ colors, diff, onRollback, onDone, importing }: any) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }).start();
  }, []);

  const total = diff.reduce((sum: number, d: DiffSummary) => sum + d.incoming, 0);

  return (
    <View style={[s.resultCard, { backgroundColor: '#27AE6012', borderColor: '#27AE6044' }]}>
      <Animated.View style={[s.resultIcon, { backgroundColor: '#27AE6020', transform: [{ scale: scaleAnim }] }]}>
        <Ionicons name="checkmark-circle" size={52} color="#27AE60" />
      </Animated.View>
      <Text style={[s.resultTitle, { color: '#27AE60' }]}>تمت الاستعادة بنجاح</Text>
      <Text style={[s.resultSub, { color: colors.textSecondary }]}>
        تم استعادة {total.toLocaleString('ar')} سجل إلى النظام
      </Text>

      <View style={s.resultActions}>
        {onRollback && (
          <TouchableOpacity
            style={[s.rollbackBtn, { borderColor: '#F39C12' }, importing && { opacity: 0.5 }]}
            onPress={onRollback}
            disabled={importing}
          >
            {importing
              ? <ActivityIndicator size="small" color="#F39C12" />
              : <Ionicons name="arrow-undo-outline" size={16} color="#F39C12" />
            }
            <Text style={[s.rollbackText, { color: '#F39C12' }]}>تراجع عن الاستعادة</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.doneBtn} onPress={onDone}>
          <Ionicons name="home-outline" size={16} color="#FFF" />
          <Text style={s.doneBtnText}>العودة</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Error Panel ──────────────────────────────────────────────────────────────
function ErrorPanel({ colors, message, onRetry }: any) {
  return (
    <View style={[s.resultCard, { backgroundColor: '#E74C3C12', borderColor: '#E74C3C44' }]}>
      <View style={[s.resultIcon, { backgroundColor: '#E74C3C20' }]}>
        <Ionicons name="close-circle" size={52} color="#E74C3C" />
      </View>
      <Text style={[s.resultTitle, { color: '#E74C3C' }]}>فشلت الاستعادة</Text>
      <Text style={[s.resultSub, { color: colors.textSecondary }]}>{message}</Text>
      <TouchableOpacity style={s.doneBtn} onPress={onRetry}>
        <Ionicons name="refresh-outline" size={16} color="#FFF" />
        <Text style={s.doneBtnText}>حاول مجدداً</Text>
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  container:     { flex: 1 },
  sectionTabs:   { flexDirection: 'row', borderBottomWidth: 1 },
  sectionTab:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  sectionTabText:{ fontSize: 14, fontWeight: '600' },

  // Console header
  consoleHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, padding: 14, marginTop: 12 },
  consoleTitle:  { flex: 1, color: '#C3AF76', fontWeight: '700', fontSize: 15 },
  statusPill:    { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 },
  statusPillText:{ fontSize: 11, fontWeight: '700' },

  // Tabs
  tabBar:  { flexDirection: 'row', borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  tabBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, padding: 12 },
  tabText: { fontSize: 13, fontWeight: '600' },

  // Drop zone
  dropZone: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 16, padding: 32, alignItems: 'center', gap: 12 },
  dropIconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  dropTitle:  { fontSize: 16, fontWeight: '700', textAlign: 'center' },
  dropSub:    { fontSize: 12, textAlign: 'center' },
  fallbackRow:{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderTopWidth: 1, paddingTop: 12, gap: 4 },
  fallbackText:{ fontSize: 13 },
  fallbackLink:{ fontSize: 13, fontWeight: '700', textDecorationLine: 'underline' },

  // Paste
  pasteWrap:  { borderWidth: 1.5, borderRadius: 12, overflow: 'hidden' },
  pasteInput: { minHeight: 180, padding: 14, fontSize: 12, lineHeight: 18 },
  clearBtn:   { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-end' },
  clearText:  { fontSize: 12 },
  charCount:  { fontSize: 11, textAlign: 'left' },

  // Validation
  validPanel:  { borderWidth: 1, borderRadius: 12, padding: 14, gap: 4 },
  validHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  validHeaderText: { fontWeight: '700', fontSize: 14, flex: 1 },
  repairedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 2 },
  repairedText: { fontSize: 10, color: '#F39C12', fontWeight: '700' },
  msgRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  msgText: { fontSize: 12, lineHeight: 18, flex: 1 },
  countsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, paddingTop: 10, borderTopWidth: 1 },
  countChip: { alignItems: 'center', minWidth: 44 },
  countNum:  { fontSize: 18, fontWeight: '800' },
  countCol:  { fontSize: 10 },

  // Diff
  section:       { borderRadius: Theme.radius.lg, borderWidth: 1, padding: Theme.spacing.md, gap: 4 },
  sectionTitle:  { fontSize: Theme.fontSize.base, fontWeight: Theme.fontWeight.bold, marginBottom: 8 },
  diffHeaderRow: { flexDirection: 'row', paddingBottom: 6, gap: 8 },
  diffColLabel:  { fontSize: 11, fontWeight: '700', flex: 1, textAlign: 'center' },
  diffRow:       { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8, borderBottomWidth: 1 },
  diffLabel:     { fontSize: 13 },
  diffNum:       { flex: 1, fontSize: 13, textAlign: 'center' },
  diffDelta:     { flex: 1, fontSize: 13, fontWeight: '700', textAlign: 'center' },
  diffWarning:   { flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 8, padding: 10, marginTop: 8 },
  diffWarningText:{ fontSize: 12, flex: 1 },

  // Confirm
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderWidth: 1, borderRadius: 12, padding: 14 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkText:{ fontSize: 13, lineHeight: 20, flex: 1 },
  restoreBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, backgroundColor: '#E74C3C', borderRadius: 14, paddingVertical: 16 },
  restoreBtnText: { color: '#FFF', fontSize: 16, fontWeight: '800' },

  // Result cards
  resultCard:   { borderWidth: 1, borderRadius: 16, padding: 28, alignItems: 'center', gap: 12, marginTop: 8 },
  resultIcon:   { width: 90, height: 90, borderRadius: 45, alignItems: 'center', justifyContent: 'center' },
  resultTitle:  { fontSize: 20, fontWeight: '800' },
  resultSub:    { fontSize: 14, textAlign: 'center', lineHeight: 22 },
  resultActions:{ flexDirection: 'row', gap: 10, marginTop: 8, flexWrap: 'wrap', justifyContent: 'center' },
  rollbackBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1.5, borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  rollbackText: { fontWeight: '700', fontSize: 14 },
  doneBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#2C3E50', borderRadius: 12, paddingHorizontal: 18, paddingVertical: 12 },
  doneBtnText:  { color: '#FFF', fontWeight: '700', fontSize: 14 },

  // Export (kept from original)
  statusCard:   { margin: Theme.spacing.base, borderRadius: Theme.radius.xl, borderWidth: 1, padding: Theme.spacing.xl, alignItems: 'center', gap: 10 },
  statusIcon:   { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
  statusTitle:  { fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
  statusSub:    { fontSize: Theme.fontSize.sm, textAlign: 'center' },
  statsGrid:    { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  statCell:     { width: '22%', flex: 1, minWidth: 70, alignItems: 'center', gap: 4, padding: 10, borderRadius: Theme.radius.lg, borderWidth: 1 },
  statVal:      { fontSize: Theme.fontSize.xl, fontWeight: Theme.fontWeight.bold },
  statLbl:      { fontSize: 10, textAlign: 'center' },
  exportBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, marginHorizontal: Theme.spacing.base, marginTop: 4, paddingVertical: 16, borderRadius: Theme.radius.xl },
  exportBtnText:{ color: '#FFF', fontSize: Theme.fontSize.lg, fontWeight: Theme.fontWeight.bold },
});
