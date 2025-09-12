import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto, UpdateVehicleDto } from '../dto';

/** Class to connect to Vehicle table in the database. */
@Injectable()
export class VehicleService {
  /** Constructor to initialize PrismaService */
  constructor(private readonly prisma: PrismaService) {}

  /** Create a new vehicle */
  async createVehicle(firebaseUid: string, data: CreateVehicleDto) {
    try {
      const user = await this.prisma.user.findUnique({
        where: { firebaseUid },
        include: { addresses: true },
      });

      if (!user) throw new Error('User not found');
      if (user.addresses.length === 0) throw new Error('User has no address');

      const userAddress = user.addresses[0];

      return await this.prisma.vehicle.create({
        data: {
          ...data,
          vehicleImage: data.vehicleImage || '',
          user: {
            connect: { firebaseUid },
          },
          addresses: {
            connect: { id: userAddress.id },
          },
        },
        include: { addresses: true },
      });
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  /** Update an existing vehicle */
  async updateVehicle(id: number, data: UpdateVehicleDto) {
    const updatedVehicle = await this.prisma.vehicle.update({
      where: { id },
      data,
    });

    return updatedVehicle;
  }

  /** Get all vehicles for a currently logged in user */
  async getMyVehicles(firebaseUid: string) {
    const myVehicles = await this.prisma.vehicle.findMany({
      where: {
        user: { firebaseUid },
      },
    });

    return myVehicles;
  }

  /** Find vehicles nearby a given location within a specified radius (in km) */
  async findVehiclesNearby(lat: number, lng: number, radius: number) {
    const results = await this.prisma.$queryRaw<
      {
        vehicle_id: number;
        make: string;
        model: string;
        year: number;
        licensePlate: string;
        color: string;
        seats: number;
        type: string;
        vehicleImage: string | null;
        verified: boolean;
        rating: number;
        hasSeatbelts: boolean;
        seatbeltType: string;
        condition: string;
        value: number;
        vin: string;
        mileage: number;
        transmission: string;
        salesTaxPaid: boolean;
        trim: string;
        bodyStyle: string;
        hasSalvageTitle: boolean;
        extraInfo: string;
        userId: number;

        // Address fields
        address_id: number;
        latitude: number;
        longitude: number;
        distance: number;
      }[]
    >`
      SELECT DISTINCT ON (v.id)
      v.id AS vehicle_id,
      v.make, v.model, v.year, v."licensePlate", v.color, v.seats, v.type,
      v."vehicleImage", v.verified, v.rating, v."hasSeatbelts", v."seatbeltType",
      v.condition, v.value, v.vin, v.mileage, v.transmission, v."salesTaxPaid",
      v.trim, v."bodyStyle", v."hasSalvageTitle", v."extraInfo", v."userId",
      a.latitude, a.longitude,
      ST_Distance(
        ST_MakePoint(a.longitude, a.latitude)::geography,
        ST_MakePoint(${lng}, ${lat})::geography
      ) AS distance
      FROM "Vehicle" v
      JOIN "_VehicleAddresses" va ON va."B" = v.id
      JOIN "Address" a ON a.id = va."A"
      WHERE ST_DWithin(
        ST_MakePoint(a.longitude, a.latitude)::geography,
        ST_MakePoint(${lng}, ${lat})::geography,
        ${radius * 1000}
      )
      ORDER BY v.id, distance ASC
  `;

    return results.map((r) => ({
      vehicle: {
        id: r.vehicle_id,
        make: r.make,
        model: r.model,
        year: r.year,
        licensePlate: r.licensePlate,
        color: r.color,
        seats: r.seats,
        type: r.type,
        vehicleImage: r.vehicleImage,
        verified: r.verified,
        rating: r.rating,
        hasSeatbelts: r.hasSeatbelts,
        seatbeltType: r.seatbeltType,
        condition: r.condition,
        value: r.value,
        vin: r.vin,
        mileage: r.mileage,
        transmission: r.transmission,
        salesTaxPaid: r.salesTaxPaid,
        trim: r.trim,
        bodyStyle: r.bodyStyle,
        hasSalvageTitle: r.hasSalvageTitle,
        extraInfo: r.extraInfo,
        userId: r.userId,
      },
      address: {
        id: r.address_id,
        latitude: r.latitude,
        longitude: r.longitude,
      },
      distanceMeters: r.distance,
    }));
  }
}
