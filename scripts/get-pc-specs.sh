#!/usr/bin/env bash
#
# Script untuk mengekstrak spesifikasi PC/Laptop di Linux untuk GAJIANICH
#

echo -e "\n========================================================"
echo -e "   GAJIANICH IT ASSET HARDWARE SPECIFICATION EXTRACTOR (Linux)"
echo -e "========================================================\n"

# 1. CPU Name
CPU_NAME=$(lscpu | grep "Model name:" | sed -e 's/Model name:[ \t]*//' | tr -s ' ')
if [ -z "$CPU_NAME" ]; then
  CPU_NAME=$(grep -m1 "model name" /proc/cpuinfo | cut -d: -f2 | sed 's/^[ \t]*//')
fi

# 2. Total RAM in GB
RAM_TOTAL_KB=$(grep MemTotal /proc/meminfo | awk '{print $2}')
RAM_SIZE_GB=$(( (RAM_TOTAL_KB + 1024*1024 - 1) / (1024*1024) ))

# 3. RAM Slots (requires dmidecode if root, fallback to 2)
RAM_SLOTS=2
if command -v dmidecode &> /dev/null && [ "$EUID" -eq 0 ]; then
  RAM_SLOTS=$(dmidecode -t memory | grep -c "Memory Device" || echo 2)
fi

# 4. Disks in GB
DISKS=($(lsblk -b -d -o TYPE,SIZE,NAME | grep disk | awk '{print int($2/1000000000)}'))
DISK1_GB=${DISKS[0]:-0}
DISK2_GB=${DISKS[1]:-""}

# 5. Model & Serial
MODEL=""
SERIAL=""
if [ -d /sys/devices/virtual/dmi/id ]; then
  SYS_VENDOR=$(cat /sys/devices/virtual/dmi/id/sys_vendor 2>/dev/null)
  PROD_NAME=$(cat /sys/devices/virtual/dmi/id/product_name 2>/dev/null)
  MODEL="$SYS_VENDOR $PROD_NAME"
  SERIAL=$(cat /sys/devices/virtual/dmi/id/product_serial 2>/dev/null)
fi

echo -e "--- RINGKASAN UNTUK FORM GAJIANICH / EXCEL IMPORT ---"
echo -e "Model / Asset Name : \e[32m$MODEL\e[0m"
echo -e "Serial Number      : \e[32m$SERIAL\e[0m"
echo -e "Processor (CPU)    : \e[32m$CPU_NAME\e[0m"
echo -e "RAM Size (GB)      : \e[32m$RAM_SIZE_GB\e[0m"
echo -e "RAM Slot Count     : \e[32m$RAM_SLOTS\e[0m"
echo -e "Disk 1 Size (GB)   : \e[32m$DISK1_GB\e[0m"
if [ -n "$DISK2_GB" ]; then
  echo -e "Disk 2 Size (GB)   : \e[32m$DISK2_GB\e[0m"
fi

echo -e "\n========================================================\n"
