#!/usr/bin/env bash
# mem-budget.sh — macOS memory budget profiler for the PinPoint memory investigation.
#
# Measures phys_footprint (the metric the kernel + "out of application memory"
# dialog use), NOT RSS. RSS double-counts shared frameworks across processes and
# is what made cmux/Chrome show identical inflated numbers in the Force-Quit panel.
#
# Modes:
#   snap  <label> [outfile]                 one detailed snapshot (system totals +
#                                           per-app footprint attribution + docker)
#   watch <label> <dur_s> <interval_s> [of] lightweight system-total sampling, for
#                                           capturing peaks during test/build runs
#   reduce <file>                           summarize a watch/snap file by label
#
# Default outfiles: /tmp/mem-budget-snaps.tsv  and  /tmp/mem-budget-watch.tsv
set -u

SNAP_COLS='epoch\tlabel\tphys_used_mb\tphys_free_mb\twired_mb\tcompressor_mb\tswap_used_mb\torbstack_mb\tclaude_mb\tnode_mb\tchrome_mb\tdocker_n\tdocker_mb\tfree_pct'
WATCH_COLS='epoch\tlabel\tphys_used_mb\tphys_free_mb\tcompressor_mb\tswap_used_mb\tnode_mb\tdocker_n'

# --- system totals (fast) ---
sys_line() { top -l 1 -n 0 | grep PhysMem; }
mb_from() { # "<num><M|G>" -> MB
  awk -v s="$1" 'BEGIN{ if(match(s,/G/)){gsub(/[^0-9.]/,"",s); print s*1024} else {gsub(/[^0-9.]/,"",s); print s} }'
}
phys_used()  { local p; p=$(sys_line); mb_from "$(echo "$p" | grep -oE '[0-9]+[MG] used'   | grep -oE '[0-9]+[MG]')"; }
phys_free()  { local p; p=$(sys_line); mb_from "$(echo "$p" | grep -oE '[0-9]+[MG] unused' | grep -oE '[0-9]+[MG]')"; }
wired_mb()   { sys_line | grep -oE '[0-9]+M wired'      | grep -oE '[0-9]+'; }
compr_mb()   { sys_line | grep -oE '[0-9]+M compressor' | grep -oE '[0-9]+'; }
swap_used()  { sysctl -n vm.swapusage | sed -E 's/.*used = ([0-9.]+)M.*/\1/'; }
free_pct()   { memory_pressure 2>/dev/null | awk -F': ' '/free percentage/{gsub(/%/,"",$2); print $2; exit}'; }

# --- per-app phys_footprint attribution (accurate; excludes shared) ---
_sum_fp_kb() { # sum phys_footprint (KB) over a list of pids on stdin
  local pid total_kb=0 nu
  while read -r pid; do
    [ -z "$pid" ] && continue
    nu=$(footprint -p "$pid" 2>/dev/null | awk '/^[[:space:]]*phys_footprint:/{print $2" "$3; exit}')
    [ -z "$nu" ] && continue
    total_kb=$(awk -v t="$total_kb" -v n="${nu% *}" -v u="${nu#* }" \
      'BEGIN{m=(u=="GB")?n*1048576:(u=="MB")?n*1024:n; print t+m}')
  done
  awk -v t="$total_kb" 'BEGIN{printf "%.0f", t/1024}'
}
group_fp_mb()  { pgrep -f "$1" 2>/dev/null | _sum_fp_kb; }   # match full argv
claude_fp_mb() { # session cores: processes whose comm basename is exactly "claude"
  ps -axo pid=,comm= | awk '{n=split($2,a,"/"); if(a[n]=="claude") print $1}' | _sum_fp_kb
}

# --- docker / orbstack containers ---
docker_n()  { docker ps -q 2>/dev/null | wc -l | tr -d ' '; }
docker_mb() {
  docker stats --no-stream --format '{{.MemUsage}}' 2>/dev/null | awk \
    '{u=$1; if(u ~ /GiB/){gsub(/GiB/,"",u); s+=u*1024} else if(u ~ /MiB/){gsub(/MiB/,"",u); s+=u} else if(u ~ /kB/){gsub(/kB/,"",u); s+=u/1024}} END{printf "%.0f", s}'
}

cmd="${1:-}"; shift || true
case "$cmd" in
  snap)
    label="${1:?label required}"; out="${2:-/tmp/mem-budget-snaps.tsv}"
    [ -f "$out" ] || printf '%s\n' "$SNAP_COLS" > "$out"
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
      "$(date +%s)" "$label" "$(phys_used)" "$(phys_free)" "$(wired_mb)" "$(compr_mb)" "$(swap_used)" \
      "$(group_fp_mb OrbStack)" "$(claude_fp_mb)" "$(group_fp_mb 'node|vitest|tsx|next-server')" \
      "$(group_fp_mb 'Google Chrome')" "$(docker_n)" "$(docker_mb)" "$(free_pct)" | tee -a "$out"
    ;;
  watch)
    label="${1:?label}"; dur="${2:?dur}"; iv="${3:?interval}"; out="${4:-/tmp/mem-budget-watch.tsv}"
    [ -f "$out" ] || printf '%s\n' "$WATCH_COLS" > "$out"
    end=$(( $(date +%s) + dur ))
    while [ "$(date +%s)" -lt "$end" ]; do
      printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' \
        "$(date +%s)" "$label" "$(phys_used)" "$(phys_free)" "$(compr_mb)" "$(swap_used)" \
        "$(group_fp_mb 'node|vitest|tsx')" "$(docker_n)" >> "$out"
      sleep "$iv"
    done
    ;;
  reduce)
    awk -F'\t' 'NR==1{next} {
      lab=$2;
      # column indices differ by file; detect by NF
      if (NF>=14){ used=$3; free=$4; comp=$6; node=$10 } else { used=$3; free=$4; comp=$5; node=$7 }
      if (free!=""){ if(minf[lab]==""||free+0<minf[lab]) minf[lab]=free+0 }
      if (node+0>maxnode[lab]) maxnode[lab]=node+0
      if (used+0>maxused[lab]) maxused[lab]=used+0
      if (comp+0>maxcomp[lab]) maxcomp[lab]=comp+0
      n[lab]++
    } END{
      printf "%-26s %-11s %-11s %-12s %-12s %s\n","label","max_used","min_free","max_node","max_compr","n";
      for(l in n) printf "%-26s %-11s %-11s %-12s %-12s %s\n", l, maxused[l], minf[l], maxnode[l], maxcomp[l], n[l]
    }' "${1:?file}"
    ;;
  *) echo "usage: $0 {snap <label>|watch <label> <dur> <iv>|reduce <file>}"; exit 2 ;;
esac
