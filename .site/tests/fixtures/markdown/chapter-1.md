Before we can learn how to design large-scale distributed system, we need to understand how computer works, atleast at high level.

![[01-light.svg]]

![[01-dark.svg]]
# Components

## Disk
- HDD, SDD
- Store all data - persistently
- Measured in 100's of GB or TB
	- 1 Byte = 8 Bits and each bit can store either 0 or 1
- reading and writing is $\frac{1}{10^3}$
## RAM (Random Access Memory)
- Storing information, lot smaller than disk, its not persistent
- storage in 2 GB, 4 GB, 8 GB, 16 GB, ...
- Costlier than disk, but cheaper in  resources
	- Writing and reading to a RAM is measured in $\mu s$ (micro-second) ($\approx \frac{1}{10^6}$)
		- very  fast (lot faster than disk)


## CPU (Central Processing Unit)
- Used to compute, talk with different components
- Reading/Writing information to Disk, RAM and execute code.

## Cache
- Lot smaller than RAM
- in MBs
- measured in ns (nano second)
- Cache is expensive, but small cache can improve the system by a lot.
- CPU caan check if the data is in cache, it can make it faster.

# Limitations
Increasing Disk, RAM, Cache doesn't help. Biggest problem is CPU, for how much we can compute in a given time.

# Moore's Law
- Founders of Intel
![[02-light.svg]]

![[02-dark.svg]]