-- CreateTable
CREATE TABLE "Device" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SensorData" (
    "id" SERIAL NOT NULL,
    "temperature" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "humidity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pressure" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "gas_resistance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "co" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nh3" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "no2" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pm1_0" INTEGER NOT NULL DEFAULT 0,
    "pm2_5" INTEGER NOT NULL DEFAULT 0,
    "pm10" INTEGER NOT NULL DEFAULT 0,
    "deviceId" TEXT,
    "location" TEXT,
    "status" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SensorData_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Device_name_key" ON "Device"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Device_deviceId_key" ON "Device"("deviceId");

-- AddForeignKey
ALTER TABLE "SensorData" ADD CONSTRAINT "SensorData_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("deviceId") ON DELETE SET NULL ON UPDATE CASCADE;
